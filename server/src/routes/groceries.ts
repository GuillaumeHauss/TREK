import express, { Request, Response } from 'express';
import { db, canAccessTrip } from '../db/database';
import { authenticate } from '../middleware/auth';
import { broadcast } from '../websocket';
import { AuthRequest } from '../types';

const router = express.Router({ mergeParams: true });

// Domain clustering keyword mapping
const DOMAIN_KEYWORDS: Record<string, string[]> = {
  Produce: ['vegetables', 'fruits', 'herbs', 'lettuce', 'tomato', 'apple', 'banana', 'carrot', 'broccoli', 'spinach', 'onion', 'garlic', 'pepper', 'cucumber', 'salad', 'orange', 'lemon', 'lime', 'strawberry', 'blueberry', 'grapes', 'melon', 'pumpkin', 'zucchini', 'eggplant'],
  Dairy: ['milk', 'cheese', 'butter', 'yogurt', 'cream', 'eggs', 'cottage cheese', 'mozzarella', 'cheddar', 'feta', 'ricotta'],
  'Meat/Fish': ['chicken', 'beef', 'pork', 'fish', 'salmon', 'turkey', 'lamb', 'duck', 'shrimp', 'cod', 'tuna', 'ham', 'bacon', 'sausage', 'steak'],
  Beverages: ['water', 'juice', 'beer', 'wine', 'soda', 'coffee', 'tea', 'milk', 'smoothie', 'lemonade', 'cola', 'sprite', 'orange juice', 'apple juice'],
  Pantry: ['flour', 'rice', 'pasta', 'oil', 'salt', 'sugar', 'spices', 'bread', 'crackers', 'cereal', 'nuts', 'beans', 'lentils', 'oats', 'canned', 'vinegar', 'soy sauce', 'honey', 'jam'],
  Frozen: ['ice cream', 'frozen vegetables', 'frozen pizza', 'frozen chicken', 'frozen fish', 'popsicles', 'sorbet'],
  Bakery: ['bread', 'croissants', 'pastries', 'baguette', 'rolls', 'cake', 'donut', 'muffin', 'bagel'],
};

// Compute domain from item name or default to 'Other'
function computeDomain(name: string): string {
  const nameLower = name.toLowerCase();
  for (const [domain, keywords] of Object.entries(DOMAIN_KEYWORDS)) {
    if (keywords.some(kw => nameLower.includes(kw))) {
      return domain;
    }
  }
  return 'Other';
}

// ─────────────────────────────────────────────────────────────────────────────
// RECIPES
// ─────────────────────────────────────────────────────────────────────────────

// GET /api/trips/:tripId/groceries/recipes
router.get('/recipes', authenticate, (req: Request, res: Response) => {
  const authReq = req as AuthRequest;
  const { tripId } = req.params;

  const trip = canAccessTrip(tripId, authReq.user.id);
  if (!trip) return res.status(404).json({ error: 'Trip not found' });

  const recipes = db.prepare(
    'SELECT * FROM recipes WHERE trip_id = ? ORDER BY sort_order ASC, created_at ASC'
  ).all(tripId) as any[];

  const recipesWithDetails = recipes.map(recipe => {
    const ingredients = db.prepare(
      'SELECT * FROM recipe_ingredients WHERE recipe_id = ? ORDER BY sort_order ASC'
    ).all(recipe.id) as any[];

    const ustensils = db.prepare(
      'SELECT * FROM recipe_ustensils WHERE recipe_id = ? ORDER BY sort_order ASC'
    ).all(recipe.id) as any[];

    return { ...recipe, ingredients, ustensils };
  });

  res.json({ recipes: recipesWithDetails });
});

// POST /api/trips/:tripId/groceries/recipes
router.post('/recipes', authenticate, (req: Request, res: Response) => {
  const authReq = req as AuthRequest;
  const { tripId } = req.params;
  const { name, description, servings, ingredients, ustensils } = req.body;

  const trip = canAccessTrip(tripId, authReq.user.id);
  if (!trip) return res.status(404).json({ error: 'Trip not found' });

  if (!name) return res.status(400).json({ error: 'Recipe name is required' });

  const maxOrder = db.prepare('SELECT MAX(sort_order) as max FROM recipes WHERE trip_id = ?').get(tripId) as { max: number | null };
  const sortOrder = (maxOrder.max !== null ? maxOrder.max : -1) + 1;

  const result = db.prepare(
    'INSERT INTO recipes (trip_id, name, description, servings, sort_order) VALUES (?, ?, ?, ?, ?)'
  ).run(tripId, name, description || null, servings || 1, sortOrder);

  const recipeId = result.lastInsertRowid as number;

  // Add ingredients
  if (ingredients && Array.isArray(ingredients)) {
    ingredients.forEach((ing: any, idx: number) => {
      db.prepare(
        'INSERT INTO recipe_ingredients (recipe_id, name, quantity, unit, sort_order, domain) VALUES (?, ?, ?, ?, ?, ?)'
      ).run(recipeId, ing.name, ing.quantity || null, ing.unit || null, idx, computeDomain(ing.name));
    });
  }

  // Add ustensils
  if (ustensils && Array.isArray(ustensils)) {
    ustensils.forEach((ust: any, idx: number) => {
      db.prepare(
        'INSERT INTO recipe_ustensils (recipe_id, name, quantity, sort_order) VALUES (?, ?, ?, ?)'
      ).run(recipeId, ust.name, ust.quantity || 1, idx);
    });
  }

  const recipe = db.prepare('SELECT * FROM recipes WHERE id = ?').get(recipeId) as any;
  const result_ingredients = db.prepare('SELECT * FROM recipe_ingredients WHERE recipe_id = ? ORDER BY sort_order ASC').all(recipeId) as any[];
  const result_ustensils = db.prepare('SELECT * FROM recipe_ustensils WHERE recipe_id = ? ORDER BY sort_order ASC').all(recipeId) as any[];

  res.status(201).json({ recipe: { ...recipe, ingredients: result_ingredients, ustensils: result_ustensils } });
  broadcast(tripId, 'groceries:recipe:created', { recipe: { ...recipe, ingredients: result_ingredients, ustensils: result_ustensils } }, req.headers['x-socket-id'] as string);
});

// PUT /api/trips/:tripId/groceries/recipes/:recipeId
router.put('/recipes/:recipeId', authenticate, (req: Request, res: Response) => {
  const authReq = req as AuthRequest;
  const { tripId, recipeId } = req.params;
  const { name, description, servings, ingredients, ustensils } = req.body;

  const trip = canAccessTrip(tripId, authReq.user.id);
  if (!trip) return res.status(404).json({ error: 'Trip not found' });

  const recipe = db.prepare('SELECT * FROM recipes WHERE id = ? AND trip_id = ?').get(recipeId, tripId);
  if (!recipe) return res.status(404).json({ error: 'Recipe not found' });

  db.prepare(`
    UPDATE recipes SET
      name = COALESCE(?, name),
      description = ?,
      servings = COALESCE(?, servings)
    WHERE id = ?
  `).run(name || null, description || null, servings || null, recipeId);

  // Update ingredients if provided
  if (ingredients && Array.isArray(ingredients)) {
    db.prepare('DELETE FROM recipe_ingredients WHERE recipe_id = ?').run(recipeId);
    ingredients.forEach((ing: any, idx: number) => {
      db.prepare(
        'INSERT INTO recipe_ingredients (recipe_id, name, quantity, unit, sort_order, domain) VALUES (?, ?, ?, ?, ?, ?)'
      ).run(recipeId, ing.name, ing.quantity || null, ing.unit || null, idx, computeDomain(ing.name));
    });
  }

  // Update ustensils if provided
  if (ustensils && Array.isArray(ustensils)) {
    db.prepare('DELETE FROM recipe_ustensils WHERE recipe_id = ?').run(recipeId);
    ustensils.forEach((ust: any, idx: number) => {
      db.prepare(
        'INSERT INTO recipe_ustensils (recipe_id, name, quantity, sort_order) VALUES (?, ?, ?, ?)'
      ).run(recipeId, ust.name, ust.quantity || 1, idx);
    });
  }

  const updated = db.prepare('SELECT * FROM recipes WHERE id = ?').get(recipeId) as any;
  const result_ingredients = db.prepare('SELECT * FROM recipe_ingredients WHERE recipe_id = ? ORDER BY sort_order ASC').all(recipeId) as any[];
  const result_ustensils = db.prepare('SELECT * FROM recipe_ustensils WHERE recipe_id = ? ORDER BY sort_order ASC').all(recipeId) as any[];

  res.json({ recipe: { ...updated, ingredients: result_ingredients, ustensils: result_ustensils } });
  broadcast(tripId, 'groceries:recipe:updated', { recipe: { ...updated, ingredients: result_ingredients, ustensils: result_ustensils } }, req.headers['x-socket-id'] as string);
});

// DELETE /api/trips/:tripId/groceries/recipes/:recipeId
router.delete('/recipes/:recipeId', authenticate, (req: Request, res: Response) => {
  const authReq = req as AuthRequest;
  const { tripId, recipeId } = req.params;

  const trip = canAccessTrip(tripId, authReq.user.id);
  if (!trip) return res.status(404).json({ error: 'Trip not found' });

  const recipe = db.prepare('SELECT id FROM recipes WHERE id = ? AND trip_id = ?').get(recipeId, tripId);
  if (!recipe) return res.status(404).json({ error: 'Recipe not found' });

  db.prepare('DELETE FROM recipe_ingredients WHERE recipe_id = ?').run(recipeId);
  db.prepare('DELETE FROM recipe_ustensils WHERE recipe_id = ?').run(recipeId);
  db.prepare('DELETE FROM recipes WHERE id = ?').run(recipeId);

  res.json({ success: true });
  broadcast(tripId, 'groceries:recipe:deleted', { recipeId: Number(recipeId) }, req.headers['x-socket-id'] as string);
});

// POST /api/trips/:tripId/groceries/recipes/:recipeId/ingredients
router.post('/recipes/:recipeId/ingredients', authenticate, (req: Request, res: Response) => {
  const authReq = req as AuthRequest;
  const { tripId, recipeId } = req.params;
  const { name, quantity, unit } = req.body;

  const trip = canAccessTrip(tripId, authReq.user.id);
  if (!trip) return res.status(404).json({ error: 'Trip not found' });

  const recipe = db.prepare('SELECT * FROM recipes WHERE id = ? AND trip_id = ?').get(recipeId, tripId);
  if (!recipe) return res.status(404).json({ error: 'Recipe not found' });

  if (!name) return res.status(400).json({ error: 'Ingredient name is required' });

  const maxOrder = db.prepare('SELECT MAX(sort_order) as max FROM recipe_ingredients WHERE recipe_id = ?').get(recipeId) as { max: number | null };
  const sortOrder = (maxOrder.max !== null ? maxOrder.max : -1) + 1;

  const result = db.prepare(
    'INSERT INTO recipe_ingredients (recipe_id, name, quantity, unit, sort_order) VALUES (?, ?, ?, ?, ?)'
  ).run(recipeId, name, quantity || null, unit || null, sortOrder);

  const ingredient = db.prepare('SELECT * FROM recipe_ingredients WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json({ ingredient });
  broadcast(tripId, 'groceries:ingredient:created', { ingredient, recipeId: Number(recipeId) }, req.headers['x-socket-id'] as string);
});

// PUT /api/trips/:tripId/groceries/recipes/:recipeId/ingredients/:ingredientId
router.put('/recipes/:recipeId/ingredients/:ingredientId', authenticate, (req: Request, res: Response) => {
  const authReq = req as AuthRequest;
  const { tripId, recipeId, ingredientId } = req.params;
  const { name, quantity, unit } = req.body;

  const trip = canAccessTrip(tripId, authReq.user.id);
  if (!trip) return res.status(404).json({ error: 'Trip not found' });

  const recipe = db.prepare('SELECT * FROM recipes WHERE id = ? AND trip_id = ?').get(recipeId, tripId);
  if (!recipe) return res.status(404).json({ error: 'Recipe not found' });

  const ingredient = db.prepare('SELECT * FROM recipe_ingredients WHERE id = ? AND recipe_id = ?').get(ingredientId, recipeId);
  if (!ingredient) return res.status(404).json({ error: 'Ingredient not found' });

  db.prepare(`
    UPDATE recipe_ingredients SET
      name = COALESCE(?, name),
      quantity = ?,
      unit = ?
    WHERE id = ?
  `).run(name || null, quantity !== undefined ? quantity : null, unit || null, ingredientId);

  const updated = db.prepare('SELECT * FROM recipe_ingredients WHERE id = ?').get(ingredientId);
  res.json({ ingredient: updated });
  broadcast(tripId, 'groceries:ingredient:updated', { ingredient: updated, recipeId: Number(recipeId) }, req.headers['x-socket-id'] as string);
});

// DELETE /api/trips/:tripId/groceries/recipes/:recipeId/ingredients/:ingredientId
router.delete('/recipes/:recipeId/ingredients/:ingredientId', authenticate, (req: Request, res: Response) => {
  const authReq = req as AuthRequest;
  const { tripId, recipeId, ingredientId } = req.params;

  const trip = canAccessTrip(tripId, authReq.user.id);
  if (!trip) return res.status(404).json({ error: 'Trip not found' });

  const recipe = db.prepare('SELECT * FROM recipes WHERE id = ? AND trip_id = ?').get(recipeId, tripId);
  if (!recipe) return res.status(404).json({ error: 'Recipe not found' });

  const ingredient = db.prepare('SELECT * FROM recipe_ingredients WHERE id = ? AND recipe_id = ?').get(ingredientId, recipeId);
  if (!ingredient) return res.status(404).json({ error: 'Ingredient not found' });

  db.prepare('DELETE FROM recipe_ingredients WHERE id = ?').run(ingredientId);
  res.json({ success: true });
  broadcast(tripId, 'groceries:ingredient:deleted', { ingredientId: Number(ingredientId), recipeId: Number(recipeId) }, req.headers['x-socket-id'] as string);
});

// ─────────────────────────────────────────────────────────────────────────────
// GROCERY ITEMS
// ─────────────────────────────────────────────────────────────────────────────

// GET /api/trips/:tripId/groceries
router.get('/', authenticate, (req: Request, res: Response) => {
  const authReq = req as AuthRequest;
  const { tripId } = req.params;

  const trip = canAccessTrip(tripId, authReq.user.id);
  if (!trip) return res.status(404).json({ error: 'Trip not found' });

  const items = db.prepare(
    'SELECT * FROM grocery_items WHERE trip_id = ? ORDER BY domain ASC, sort_order ASC, created_at ASC'
  ).all(tripId) as any[];

  // Group by domain
  const grouped: Record<string, any[]> = {};
  items.forEach(item => {
    if (!grouped[item.domain]) {
      grouped[item.domain] = [];
    }
    grouped[item.domain].push(item);
  });

  res.json({ items, grouped });
});

// POST /api/trips/:tripId/groceries
router.post('/', authenticate, (req: Request, res: Response) => {
  const authReq = req as AuthRequest;
  const { tripId } = req.params;
  const { name, quantity, unit, domain } = req.body;

  const trip = canAccessTrip(tripId, authReq.user.id);
  if (!trip) return res.status(404).json({ error: 'Trip not found' });

  if (!name) return res.status(400).json({ error: 'Item name is required' });

  const maxOrder = db.prepare('SELECT MAX(sort_order) as max FROM grocery_items WHERE trip_id = ?').get(tripId) as { max: number | null };
  const sortOrder = (maxOrder.max !== null ? maxOrder.max : -1) + 1;

  // Auto-compute domain if not provided
  const computedDomain = domain || computeDomain(name);

  const result = db.prepare(
    'INSERT INTO grocery_items (trip_id, name, quantity, unit, domain, is_manual, sort_order) VALUES (?, ?, ?, ?, ?, 1, ?)'
  ).run(tripId, name, quantity || 1, unit || null, computedDomain, sortOrder);

  const item = db.prepare('SELECT * FROM grocery_items WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json({ item });
  broadcast(tripId, 'groceries:item:created', { item }, req.headers['x-socket-id'] as string);
});

// PUT /api/trips/:tripId/groceries/:itemId
router.put('/:itemId', authenticate, (req: Request, res: Response) => {
  const authReq = req as AuthRequest;
  const { tripId, itemId } = req.params;
  const { name, quantity, unit, domain, checked } = req.body;

  const trip = canAccessTrip(tripId, authReq.user.id);
  if (!trip) return res.status(404).json({ error: 'Trip not found' });

  const item = db.prepare('SELECT * FROM grocery_items WHERE id = ? AND trip_id = ?').get(itemId, tripId);
  if (!item) return res.status(404).json({ error: 'Item not found' });

  db.prepare(`
    UPDATE grocery_items SET
      name = COALESCE(?, name),
      quantity = COALESCE(?, quantity),
      unit = ?,
      domain = COALESCE(?, domain),
      checked = CASE WHEN ? IS NOT NULL THEN ? ELSE checked END
    WHERE id = ?
  `).run(
    name || null,
    quantity !== undefined ? quantity : null,
    unit || null,
    domain || null,
    checked !== undefined ? 1 : null,
    checked ? 1 : 0,
    itemId
  );

  const updated = db.prepare('SELECT * FROM grocery_items WHERE id = ?').get(itemId);
  res.json({ item: updated });
  broadcast(tripId, 'groceries:item:updated', { item: updated }, req.headers['x-socket-id'] as string);
});

// DELETE /api/trips/:tripId/groceries/:itemId
router.delete('/:itemId', authenticate, (req: Request, res: Response) => {
  const authReq = req as AuthRequest;
  const { tripId, itemId } = req.params;

  const trip = canAccessTrip(tripId, authReq.user.id);
  if (!trip) return res.status(404).json({ error: 'Trip not found' });

  const item = db.prepare('SELECT id FROM grocery_items WHERE id = ? AND trip_id = ?').get(itemId, tripId);
  if (!item) return res.status(404).json({ error: 'Item not found' });

  db.prepare('DELETE FROM grocery_items WHERE id = ?').run(itemId);
  res.json({ success: true });
  broadcast(tripId, 'groceries:item:deleted', { itemId: Number(itemId) }, req.headers['x-socket-id'] as string);
});

// POST /api/trips/:tripId/groceries/add-from-recipe/:recipeId
router.post('/add-from-recipe/:recipeId', authenticate, (req: Request, res: Response) => {
  const authReq = req as AuthRequest;
  const { tripId, recipeId } = req.params;
  const { servings } = req.body;

  const trip = canAccessTrip(tripId, authReq.user.id);
  if (!trip) return res.status(404).json({ error: 'Trip not found' });

  const recipe = db.prepare('SELECT * FROM recipes WHERE id = ? AND trip_id = ?').get(recipeId, tripId);
  if (!recipe) return res.status(404).json({ error: 'Recipe not found' });

  const ingredients = db.prepare('SELECT * FROM recipe_ingredients WHERE recipe_id = ?').all(recipeId) as any[];

  const addedItems: any[] = [];

  ingredients.forEach((ing: any) => {
    const multiplier = (servings || recipe.servings) / recipe.servings;
    const quantity = ing.quantity ? ing.quantity * multiplier : 1;

    const maxOrder = db.prepare('SELECT MAX(sort_order) as max FROM grocery_items WHERE trip_id = ?').get(tripId) as { max: number | null };
    const sortOrder = (maxOrder.max !== null ? maxOrder.max : -1) + 1;

    const domain = computeDomain(ing.name);

    const result = db.prepare(
      'INSERT INTO grocery_items (trip_id, name, quantity, unit, domain, is_manual, sort_order) VALUES (?, ?, ?, ?, ?, 0, ?)'
    ).run(tripId, ing.name, quantity, ing.unit || null, domain, sortOrder);

    const item = db.prepare('SELECT * FROM grocery_items WHERE id = ?').get(result.lastInsertRowid);
    addedItems.push(item);
  });

  res.status(201).json({ items: addedItems });
  broadcast(tripId, 'groceries:items:added', { items: addedItems }, req.headers['x-socket-id'] as string);
});

export default router;
