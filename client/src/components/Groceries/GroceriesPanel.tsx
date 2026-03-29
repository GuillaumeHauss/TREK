import { useState, useMemo } from 'react'
import { Plus, X, Pencil, Trash2, ChevronDown, ChevronRight, CheckSquare, Square, ShoppingCart, ChefHat } from 'lucide-react'
import { useTranslation } from '../../i18n'
import { useToast } from '../shared/Toast'
import type { Recipe, RecipeIngredient, RecipeUstensil, GroceryItem } from '../../types'

interface GroceriesPanelProps {
  tripId: number
  recipes: Recipe[]
  groceryItems: GroceryItem[]
  onLoadRecipes: (tripId: number) => Promise<void>
  onLoadGroceryItems: (tripId: number) => Promise<void>
  onCreateRecipe: (tripId: number, data: any) => Promise<Recipe>
  onUpdateRecipe: (tripId: number, recipeId: number, data: any) => Promise<Recipe>
  onDeleteRecipe: (tripId: number, recipeId: number) => Promise<void>
  onAddRecipeIngredient: (tripId: number, recipeId: number, data: any) => Promise<RecipeIngredient>
  onUpdateRecipeIngredient: (tripId: number, recipeId: number, ingredientId: number, data: any) => Promise<RecipeIngredient>
  onDeleteRecipeIngredient: (tripId: number, recipeId: number, ingredientId: number) => Promise<void>
  onAddGroceryItem: (tripId: number, data: any) => Promise<GroceryItem>
  onUpdateGroceryItem: (tripId: number, itemId: number, data: any) => Promise<GroceryItem>
  onDeleteGroceryItem: (tripId: number, itemId: number) => Promise<void>
  onAddRecipeIngredientsToShoppingList: (tripId: number, recipeId: number, servings?: number) => Promise<GroceryItem[]>
}

const DOMAIN_ORDER = ['Produce', 'Meat/Fish', 'Dairy', 'Beverages', 'Pantry', 'Bakery', 'Frozen', 'Other']

const UNIT_OPTIONS = [
  'pieces',
  'kg',
  'g',
  'l',
  'ml',
  'cups',
  'tbsp',
  'tsp',
  'oz',
  'lb',
  'pint',
  'quart',
  'gallon',
  'bunch',
  'head',
  'can',
  'bottle',
  'package',
  'box',
  'bag',
  'jar',
  'tube',
  'roll',
  'slice',
  'clove',
  'stalk',
  'sprig',
  'handful',
]

// ── Recipes Tab ────────────────────────────────────────────────────────────
function RecipesTab({
  tripId,
  recipes,
  onCreateRecipe,
  onUpdateRecipe,
  onDeleteRecipe,
  onAddRecipeIngredient,
  onUpdateRecipeIngredient,
  onDeleteRecipeIngredient,
  onAddRecipeIngredientsToShoppingList,
}: {
  tripId: number
  recipes: Recipe[]
  onCreateRecipe: (tripId: number, data: any) => Promise<Recipe>
  onUpdateRecipe: (tripId: number, recipeId: number, data: any) => Promise<Recipe>
  onDeleteRecipe: (tripId: number, recipeId: number) => Promise<void>
  onAddRecipeIngredient: (tripId: number, recipeId: number, data: any) => Promise<RecipeIngredient>
  onUpdateRecipeIngredient: (tripId: number, recipeId: number, ingredientId: number, data: any) => Promise<RecipeIngredient>
  onDeleteRecipeIngredient: (tripId: number, recipeId: number, ingredientId: number) => Promise<void>
  onAddRecipeIngredientsToShoppingList: (tripId: number, recipeId: number, servings?: number) => Promise<GroceryItem[]>
}) {
  const [isCreating, setIsCreating] = useState(false)
  const [editingRecipe, setEditingRecipe] = useState<number | null>(null)
  const [recipeName, setRecipeName] = useState('')
  const [recipeDescription, setRecipeDescription] = useState('')
  const [recipeServings, setRecipeServings] = useState(1)
  const [ingredients, setIngredients] = useState<Array<{ name: string; quantity?: number; unit?: string; domain?: string }>>([])
  const [ustensils, setUstensils] = useState<Array<{ name: string; quantity?: number }>>([])
  const [ingName, setIngName] = useState('')
  const [ingQuantity, setIngQuantity] = useState<number | undefined>()
  const [ingUnit, setIngUnit] = useState('')
  const [ingDomain, setIngDomain] = useState('Other')
  const [ustName, setUstName] = useState('')
  const [ustQuantity, setUstQuantity] = useState<number | undefined>(1)
  const { t } = useTranslation()
  const toast = useToast()

  const currentRecipe = editingRecipe ? recipes.find(r => r.id === editingRecipe) : null

  const handleAddIngredient = () => {
    if (!ingName.trim()) return
    setIngredients([...ingredients, { name: ingName, quantity: ingQuantity, unit: ingUnit, domain: ingDomain }])
    setIngName('')
    setIngQuantity(undefined)
    setIngUnit('')
    setIngDomain('Other')
  }

  const handleRemoveIngredient = (idx: number) => {
    setIngredients(ingredients.filter((_, i) => i !== idx))
  }

  const handleAddUstensil = () => {
    if (!ustName.trim()) return
    setUstensils([...ustensils, { name: ustName, quantity: ustQuantity || 1 }])
    setUstName('')
    setUstQuantity(1)
  }

  const handleRemoveUstensil = (idx: number) => {
    setUstensils(ustensils.filter((_, i) => i !== idx))
  }

  const handleSaveRecipe = async () => {
    if (!recipeName.trim()) {
      toast.error('Recipe name required')
      return
    }
    // Validation (backend requires at least name)
    if (!recipeName || recipeName.trim().length === 0) {
      toast.error('Recipe name is required')
      return
    }

    const payload = {
      name: recipeName.trim(),
      description: recipeDescription.trim() || undefined,
      servings: recipeServings || 1,
      ingredients,
      ustensils,
    }

    console.debug('Saving recipe', { tripId, editingRecipe, payload })

    try {
      if (editingRecipe) {
        await onUpdateRecipe(tripId, editingRecipe, payload)
        toast.success('Recipe updated')
      } else {
        await onCreateRecipe(tripId, payload)
        toast.success('Recipe created')
      }
      resetForm()
    } catch (err: unknown) {
      console.error('Failed to save recipe', err)
      const errorMessage = err instanceof Error ? err.message : 'Unknown error'
      toast.error(`Failed to save recipe: ${errorMessage}`)
    }
  }

  const resetForm = () => {
    setIsCreating(false)
    setEditingRecipe(null)
    setRecipeName('')
    setRecipeDescription('')
    setRecipeServings(1)
    setIngredients([])
    setUstensils([])
  }

  const handleEditRecipe = (recipe: Recipe) => {
    setEditingRecipe(recipe.id)
    setRecipeName(recipe.name)
    setRecipeDescription(recipe.description || '')
    setRecipeServings(recipe.servings)
    setIngredients(recipe.ingredients || [])
    setUstensils(recipe.ustensils || [])
  }

  const handleDeleteRecipe = async (recipeId: number) => {
    if (!confirm('Delete recipe?')) return
    try {
      await onDeleteRecipe(tripId, recipeId)
      toast.success('Recipe deleted')
    } catch {
      toast.error('Failed to delete recipe')
    }
  }

  const handleAddToShoppingList = async (recipeId: number, servings: number) => {
    try {
      await onAddRecipeIngredientsToShoppingList(tripId, recipeId, servings)
      toast.success('Ingredients added to shopping list')
    } catch {
      toast.error('Failed to add ingredients')
    }
  }

  return (
    <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
      {!isCreating && !editingRecipe ? (
        <button
          onClick={() => setIsCreating(true)}
          style={{
            padding: '10px 16px',
            background: '#3b82f6',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            fontSize: '14px',
            fontWeight: 600,
          }}
        >
          <Plus size={16} /> New Recipe
        </button>
      ) : null}

      {(isCreating || editingRecipe) && (
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-primary)', borderRadius: '12px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <input
            type="text"
            placeholder="Recipe name"
            value={recipeName}
            onChange={e => setRecipeName(e.target.value)}
            style={{ padding: '8px', border: '1px solid var(--border-primary)', borderRadius: '6px', fontFamily: 'inherit', fontSize: '14px' }}
          />
          <input
            type="text"
            placeholder="Description"
            value={recipeDescription}
            onChange={e => setRecipeDescription(e.target.value)}
            style={{ padding: '8px', border: '1px solid var(--border-primary)', borderRadius: '6px', fontFamily: 'inherit', fontSize: '14px' }}
          />
          <div style={{ display: 'flex', gap: '8px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '14px' }}>
              Servings:
              <input
                type="number"
                min="1"
                value={recipeServings}
                onChange={e => setRecipeServings(parseInt(e.target.value) || 1)}
                style={{ padding: '6px', border: '1px solid var(--border-primary)', borderRadius: '4px', width: '60px', fontFamily: 'inherit' }}
              />
            </label>
          </div>

          <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>{t('groceries.ingredients')}</div>
          {ingredients.map((ing, idx) => (
            <div key={idx} style={{ display: 'flex', gap: '8px', alignItems: 'center', background: 'var(--bg-secondary)', padding: '8px', borderRadius: '6px', justifyContent: 'space-between' }}>
              <div style={{ flex: 1, fontSize: '14px' }}>
                <div>{ing.quantity && `${ing.quantity} ${ing.unit || ''}`} {ing.name}</div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>({t(`groceries.domain.${ing.domain || 'Other'}`)})</div>
              </div>
              <button
                onClick={() => handleRemoveIngredient(idx)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', padding: '4px', flexShrink: 0 }}
              >
                <X size={14} />
              </button>
            </div>
          ))}

          <div style={{ display: 'flex', gap: '8px' }}>
            <input
              type="text"
              placeholder={t('groceries.ingredientName')}
              value={ingName}
              onChange={e => setIngName(e.target.value)}
              style={{ flex: 1, padding: '8px', border: '1px solid var(--border-primary)', borderRadius: '6px', fontFamily: 'inherit', fontSize: '13px' }}
            />
            <input
              type="number"
              placeholder={t('groceries.quantity')}
              value={ingQuantity || ''}
              onChange={e => setIngQuantity(e.target.value ? parseFloat(e.target.value) : undefined)}
              style={{ width: '60px', padding: '8px', border: '1px solid var(--border-primary)', borderRadius: '6px', fontFamily: 'inherit', fontSize: '13px' }}
            />
            <select
              value={ingUnit}
              onChange={e => setIngUnit(e.target.value)}
              style={{ width: '80px', padding: '8px', border: '1px solid var(--border-primary)', borderRadius: '6px', fontFamily: 'inherit', fontSize: '13px', background: 'var(--bg-primary)', color: 'var(--text-primary)' }}
            >
              <option value="">{t('groceries.unit')}</option>
              {UNIT_OPTIONS.map(unit => (
                <option key={unit} value={unit}>{unit}</option>
              ))}
            </select>
            <select
              value={ingDomain}
              onChange={e => setIngDomain(e.target.value)}
              style={{ width: '100px', padding: '8px', border: '1px solid var(--border-primary)', borderRadius: '6px', fontFamily: 'inherit', fontSize: '13px', background: 'var(--bg-primary)', color: 'var(--text-primary)' }}
            >
              {DOMAIN_ORDER.map(domain => (
                <option key={domain} value={domain}>{t(`groceries.domain.${domain}`)}</option>
              ))}
            </select>
            <button
              onClick={handleAddIngredient}
              style={{
                padding: '8px 12px',
                background: '#10b981',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '13px',
              }}
            >
              <Plus size={14} />
            </button>
          </div>

          <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Ustensils</div>
          {ustensils.map((ust, idx) => (
            <div key={idx} style={{ display: 'flex', gap: '8px', alignItems: 'center', background: 'var(--bg-secondary)', padding: '8px', borderRadius: '6px' }}>
              <span style={{ flex: 1, fontSize: '14px' }}>
                {ust.quantity && ust.quantity > 1 ? `${ust.quantity} x ` : ''}{ust.name}
              </span>
              <button
                onClick={() => handleRemoveUstensil(idx)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', padding: '4px' }}
              >
                <X size={14} />
              </button>
            </div>
          ))}

          <div style={{ display: 'flex', gap: '8px' }}>
            <input
              type="text"
              placeholder="Ustensil name"
              value={ustName}
              onChange={e => setUstName(e.target.value)}
              style={{ flex: 1, padding: '8px', border: '1px solid var(--border-primary)', borderRadius: '6px', fontFamily: 'inherit', fontSize: '13px' }}
            />
            <input
              type="number"
              placeholder="Qty"
              min="1"
              value={ustQuantity || ''}
              onChange={e => setUstQuantity(e.target.value ? parseInt(e.target.value) : undefined)}
              style={{ width: '60px', padding: '8px', border: '1px solid var(--border-primary)', borderRadius: '6px', fontFamily: 'inherit', fontSize: '13px' }}
            />
            <button
              onClick={handleAddUstensil}
              style={{
                padding: '8px 12px',
                background: '#10b981',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '13px',
              }}
            >
              <Plus size={14} />
            </button>
          </div>

          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={handleSaveRecipe}
              style={{
                flex: 1,
                padding: '10px',
                background: '#3b82f7',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                fontWeight: 600,
                fontSize: '14px',
              }}
            >
              Save
            </button>
            <button
              onClick={resetForm}
              style={{
                padding: '10px 16px',
                background: 'var(--bg-tertiary)',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '14px',
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {recipes.map(recipe => (
          <div key={recipe.id} style={{ background: 'var(--bg-card)', border: '1px solid var(--border-secondary)', borderRadius: '10px', padding: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)' }}>{recipe.name}</div>
                {recipe.description && <div style={{ fontSize: '13px', color: 'var(--text-faint)', marginTop: '4px' }}>{recipe.description}</div>}
                <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
                  {recipe.ingredients?.length || 0} ingredients • {recipe.servings} servings
                </div>
              </div>
              <div style={{ display: 'flex', gap: '6px' }}>
                <button
                  onClick={() => handleEditRecipe(recipe)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-faint)', padding: '6px' }}
                >
                  <Pencil size={14} />
                </button>
                <button
                  onClick={() => handleDeleteRecipe(recipe.id)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', padding: '6px' }}
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
            <button
              onClick={() => handleAddToShoppingList(recipe.id, recipe.servings)}
              style={{
                padding: '8px 12px',
                background: '#10b981',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '12px',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                justifyContent: 'center',
              }}
            >
              <ShoppingCart size={14} /> Add to Shopping List
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Manual Items Tab ────────────────────────────────────────────────────────
function ManualItemsTab({
  tripId,
  groceryItems,
  onAddGroceryItem,
  onDeleteGroceryItem,
}: {
  tripId: number
  groceryItems: GroceryItem[]
  onAddGroceryItem: (tripId: number, data: any) => Promise<GroceryItem>
  onDeleteGroceryItem: (tripId: number, itemId: number) => Promise<void>
}) {
  const [itemName, setItemName] = useState('')
  const [itemQuantity, setItemQuantity] = useState('1')
  const [itemUnit, setItemUnit] = useState('')
  const { t } = useTranslation()
  const toast = useToast()

  const manualItems = groceryItems.filter(i => i.is_manual)

  const handleAddItem = async () => {
    if (!itemName.trim()) {
      toast.error('Item name required')
      return
    }
    try {
      await onAddGroceryItem(tripId, {
        name: itemName,
        quantity: parseFloat(itemQuantity) || 1,
        unit: itemUnit || undefined,
      })
      setItemName('')
      setItemQuantity('1')
      setItemUnit('')
      toast.success('Item added')
    } catch {
      toast.error('Failed to add item')
    }
  }

  const handleDeleteItem = async (itemId: number) => {
    if (!confirm('Delete item?')) return
    try {
      await onDeleteGroceryItem(tripId, itemId)
      toast.success('Item deleted')
    } catch {
      toast.error('Failed to delete item')
    }
  }

  return (
    <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
      <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-primary)', borderRadius: '12px', padding: '12px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
        <input
          type="text"
          placeholder="Water, Beers, Chips..."
          value={itemName}
          onChange={e => setItemName(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleAddItem()}
          style={{ flex: 1, minWidth: '150px', padding: '8px', border: '1px solid var(--border-primary)', borderRadius: '6px', fontFamily: 'inherit', fontSize: '14px' }}
        />
        <input
          type="number"
          placeholder="Qty"
          value={itemQuantity}
          onChange={e => setItemQuantity(e.target.value)}
          style={{ width: '60px', padding: '8px', border: '1px solid var(--border-primary)', borderRadius: '6px', fontFamily: 'inherit', fontSize: '14px' }}
        />
        <select
          value={itemUnit}
          onChange={e => setItemUnit(e.target.value)}
          style={{ width: '80px', padding: '8px', border: '1px solid var(--border-primary)', borderRadius: '6px', fontFamily: 'inherit', fontSize: '14px', background: 'var(--bg-primary)', color: 'var(--text-primary)' }}
        >
          <option value="">Unit</option>
          {UNIT_OPTIONS.map(unit => (
            <option key={unit} value={unit}>{unit}</option>
          ))}
        </select>
        <button
          onClick={handleAddItem}
          style={{
            padding: '8px 16px',
            background: '#3b82f7',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
            fontSize: '14px',
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
          }}
        >
          <Plus size={16} /> Add
        </button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {manualItems.map(item => (
          <div
            key={item.id}
            style={{
              background: 'var(--bg-card)',
              border: '1px solid var(--border-secondary)',
              borderRadius: '8px',
              padding: '10px 12px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <span style={{ fontSize: '14px', color: 'var(--text-primary)' }}>
              {item.quantity} {item.unit && item.unit} {item.name}
              <span style={{ fontSize: '12px', color: 'var(--text-muted)', marginLeft: '8px' }}>({item.domain})</span>
            </span>
            <button
              onClick={() => handleDeleteItem(item.id)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', padding: '6px' }}
            >
              <Trash2 size={14} />
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Shopping List Tab ────────────────────────────────────────────────────────
function ShoppingListTab({
  tripId,
  groceryItems,
  onUpdateGroceryItem,
}: {
  tripId: number
  groceryItems: GroceryItem[]
  onUpdateGroceryItem: (tripId: number, itemId: number, data: any) => Promise<GroceryItem>
}) {
  const { t } = useTranslation()
  const toast = useToast()
  const [expandedDomains, setExpandedDomains] = useState<Record<string, boolean>>({})

  const grouped = useMemo(() => {
    const map: Record<string, GroceryItem[]> = {}
    groceryItems.forEach(item => {
      if (!map[item.domain]) map[item.domain] = []
      map[item.domain].push(item)
    })
    return Object.entries(map)
      .sort(([a], [b]) => {
        const aIdx = DOMAIN_ORDER.indexOf(a)
        const bIdx = DOMAIN_ORDER.indexOf(b)
        return (aIdx === -1 ? DOMAIN_ORDER.length : aIdx) - (bIdx === -1 ? DOMAIN_ORDER.length : bIdx)
      })
      .map(([domain, items]) => ({
        domain,
        items,
        checked: items.filter(i => i.checked).length,
        total: items.length,
      }))
  }, [groceryItems])

  const handleToggleItem = async (item: GroceryItem) => {
    try {
      await onUpdateGroceryItem(tripId, item.id, { checked: !item.checked })
    } catch {
      toast.error('Failed to update item')
    }
  }

  const totalChecked = groceryItems.filter(i => i.checked).length
  const totalItems = groceryItems.length
  const progress = totalItems > 0 ? Math.round((totalChecked / totalItems) * 100) : 0

  return (
    <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
      <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-primary)', borderRadius: '12px', padding: '12px' }}>
        <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '8px' }}>Shopping Progress</div>
        <div style={{ fontSize: '20px', fontWeight: 700, color: '#3b82f7', marginBottom: '8px' }}>
          {totalChecked} / {totalItems}
        </div>
        <div style={{ width: '100%', height: '8px', background: 'var(--bg-secondary)', borderRadius: '4px', overflow: 'hidden' }}>
          <div
            style={{
              width: `${progress}%`,
              height: '100%',
              background: '#10b981',
              transition: 'width 0.3s',
            }}
          />
        </div>
        <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '6px' }}>{progress}% complete</div>
      </div>

      {grouped.length === 0 ? (
        <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '24px' }}>No items in shopping list yet</div>
      ) : (
        grouped.map(({ domain, items, checked, total }) => (
          <div key={domain} style={{ background: 'var(--bg-card)', border: '1px solid var(--border-secondary)', borderRadius: '10px', overflow: 'hidden' }}>
            <button
              onClick={() => setExpandedDomains(prev => ({ ...prev, [domain]: !prev[domain] }))}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '12px',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                borderBottom: expandedDomains[domain] ? '1px solid var(--border-secondary)' : 'none',
                textAlign: 'left',
              }}
            >
              {expandedDomains[domain] ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
              <span style={{ fontWeight: 600, color: 'var(--text-secondary)', fontSize: '14px', flex: 1, textTransform: 'uppercase' }}>{domain}</span>
              <span
                style={{
                  fontSize: '12px',
                  fontWeight: 600,
                  padding: '2px 8px',
                  borderRadius: '4px',
                  background: checked === total ? 'rgba(16,185,129,0.12)' : 'var(--bg-tertiary)',
                  color: checked === total ? '#10b981' : 'var(--text-muted)',
                }}
              >
                {checked}/{total}
              </span>
            </button>
            {expandedDomains[domain] && (
              <div style={{ padding: '8px 0' }}>
                {items.map(item => (
                  <button
                    key={item.id}
                    onClick={() => handleToggleItem(item)}
                    style={{
                      width: '100%',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px',
                      padding: '10px 12px',
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      color: item.checked ? 'var(--text-faint)' : 'var(--text-primary)',
                      textDecoration: item.checked ? 'line-through' : 'none',
                      borderBottom: '1px solid var(--border-secondary)',
                    }}
                  >
                    {item.checked ? <CheckSquare size={16} color="#10b981" /> : <Square size={16} />}
                    <span style={{ flex: 1, fontSize: '14px', textAlign: 'left' }}>
                      {item.quantity} {item.unit && item.unit} {item.name}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        ))
      )}
    </div>
  )
}

// ── Ustensils Tab ───────────────────────────────────────────────────────────
function UstensilsTab({ recipes }: { recipes: Recipe[] }) {
  const ustensilSummary = useMemo(() => {
    const map = new Map<string, number>()
    recipes.forEach(recipe => {
      recipe.ustensils?.forEach(ust => {
        map.set(ust.name, (map.get(ust.name) || 0) + 1)
      })
    })
    return Array.from(map.entries()).filter(([_, count]) => count > 1).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count)
  }, [recipes])

  return (
    <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
      <div style={{ fontSize: '16px', fontWeight: 600 }}>Shared Ustensils</div>
      {ustensilSummary.length === 0 ? (
        <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '24px' }}>No ustensils shared across multiple recipes yet</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {ustensilSummary.map(ust => (
            <div key={ust.name} style={{ background: 'var(--bg-card)', border: '1px solid var(--border-secondary)', borderRadius: '8px', padding: '12px' }}>
              <div style={{ fontSize: '14px', color: 'var(--text-primary)', fontWeight: 600 }}>{ust.name}</div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>Used in {ust.count} recipes</div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Main Groceries Panel ────────────────────────────────────────────────────
export interface GroceriesTab {
  id: string
  label: string
  icon: React.ReactNode
}

export default function GroceriesPanel(props: GroceriesPanelProps) {
  const [activeTab, setActiveTab] = useState<'recipes' | 'manual' | 'shopping' | 'ustensils'>('shopping')
  const { t } = useTranslation()

  const tabs: GroceriesTab[] = [
    { id: 'shopping', label: 'Shopping List', icon: <ShoppingCart size={16} /> },
    { id: 'recipes', label: 'Recipes', icon: <ShoppingCart size={16} /> },
    { id: 'manual', label: 'Add Items', icon: <Plus size={16} /> },
    { id: 'ustensils', label: 'Ustensils', icon: <ChefHat size={16} /> },
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--bg-primary)' }}>
      {/* Tab bar */}
      <div
        style={{
          display: 'flex',
          gap: '4px',
          padding: '12px 16px',
          borderBottom: '1px solid var(--border-secondary)',
          background: 'var(--bg-card)',
        }}
      >
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            style={{
              padding: '8px 16px',
              background: activeTab === tab.id ? '#3b82f7' : 'var(--bg-secondary)',
              color: activeTab === tab.id ? 'white' : 'var(--text-secondary)',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '13px',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {activeTab === 'shopping' && (
          <ShoppingListTab tripId={props.tripId} groceryItems={props.groceryItems} onUpdateGroceryItem={props.onUpdateGroceryItem} />
        )}
        {activeTab === 'recipes' && (
          <RecipesTab
            tripId={props.tripId}
            recipes={props.recipes}
            onCreateRecipe={props.onCreateRecipe}
            onUpdateRecipe={props.onUpdateRecipe}
            onDeleteRecipe={props.onDeleteRecipe}
            onAddRecipeIngredient={props.onAddRecipeIngredient}
            onUpdateRecipeIngredient={props.onUpdateRecipeIngredient}
            onDeleteRecipeIngredient={props.onDeleteRecipeIngredient}
            onAddRecipeIngredientsToShoppingList={props.onAddRecipeIngredientsToShoppingList}
          />
        )}
        {activeTab === 'manual' && (
          <ManualItemsTab
            tripId={props.tripId}
            groceryItems={props.groceryItems}
            onAddGroceryItem={props.onAddGroceryItem}
            onDeleteGroceryItem={props.onDeleteGroceryItem}
          />
        )}
        {activeTab === 'ustensils' && (
          <UstensilsTab recipes={props.recipes} />
        )}
      </div>
    </div>
  )
}
