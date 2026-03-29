import { RecipeIngredient, RecipeUstensil, Recipe, GroceryItem, ShoppingListDomain } from '../../types'
import { groceriesApi } from '../../api/client'

export interface GroceriesSlice {
  recipes: Recipe[]
  groceryItems: GroceryItem[]
  shoppingListByDomain: ShoppingListDomain[]

  loadRecipes: (tripId: number | string) => Promise<void>
  loadGroceryItems: (tripId: number | string) => Promise<void>
  createRecipe: (tripId: number | string, data: { name: string; description?: string; servings?: number; ingredients?: Array<{ name: string; quantity?: number; unit?: string }>; ustensils?: Array<{ name: string; quantity?: number }> }) => Promise<Recipe>
  updateRecipe: (tripId: number | string, recipeId: number, data: { name?: string; description?: string; servings?: number }) => Promise<Recipe>
  deleteRecipe: (tripId: number | string, recipeId: number) => Promise<void>
  addRecipeIngredient: (tripId: number | string, recipeId: number, data: { name: string; quantity?: number; unit?: string }) => Promise<RecipeIngredient>
  updateRecipeIngredient: (tripId: number | string, recipeId: number, ingredientId: number, data: { name?: string; quantity?: number; unit?: string }) => Promise<RecipeIngredient>
  deleteRecipeIngredient: (tripId: number | string, recipeId: number, ingredientId: number) => Promise<void>
  addGroceryItem: (tripId: number | string, data: { name: string; quantity?: number; unit?: string; domain?: string }) => Promise<GroceryItem>
  updateGroceryItem: (tripId: number | string, itemId: number, data: { name?: string; quantity?: number; unit?: string; domain?: string; checked?: boolean }) => Promise<GroceryItem>
  deleteGroceryItem: (tripId: number | string, itemId: number) => Promise<void>
  addRecipeIngredientsToShoppingList: (tripId: number | string, recipeId: number, servings?: number) => Promise<GroceryItem[]>
  toggleGroceryItem: (tripId: number | string, itemId: number, checked: boolean) => Promise<void>

  // Remote event handlers
  _onRecipeCreated: (recipe: Recipe) => void
  _onRecipeUpdated: (recipe: Recipe) => void
  _onRecipeDeleted: (recipeId: number) => void
  _onIngredientCreated: (ingredient: RecipeIngredient, recipeId: number) => void
  _onIngredientUpdated: (ingredient: RecipeIngredient, recipeId: number) => void
  _onIngredientDeleted: (ingredientId: number, recipeId: number) => void
  _onGroceryItemCreated: (item: GroceryItem) => void
  _onGroceryItemUpdated: (item: GroceryItem) => void
  _onGroceryItemDeleted: (itemId: number) => void
  _onGroceryItemsAdded: (items: GroceryItem[]) => void
}

export { createGroceriesSlice }

function createGroceriesSlice(set: any, get: any): GroceriesSlice {
  const buildShoppingListByDomain = (items: GroceryItem[]): ShoppingListDomain[] => {
    const grouped: Record<string, GroceryItem[]> = {}
    items.forEach(item => {
      if (!grouped[item.domain]) grouped[item.domain] = []
      grouped[item.domain].push(item)
    })

    return Object.entries(grouped).map(([domain, domainItems]) => ({
      domain,
      items: domainItems,
      itemCount: domainItems.length,
      checkedCount: domainItems.filter(i => i.checked).length,
    }))
  }

  return {
    recipes: [],
    groceryItems: [],
    shoppingListByDomain: [],

    loadRecipes: async (tripId: number | string) => {
      const recipes = await groceriesApi.getRecipes(tripId)
      set({ recipes })
    },

    loadGroceryItems: async (tripId: number | string) => {
      const groceryItems = await groceriesApi.getGroceryItems(tripId)
      const shoppingListByDomain = buildShoppingListByDomain(groceryItems)
      set({ groceryItems, shoppingListByDomain })
    },

    createRecipe: async (tripId: number | string, data: { name: string; description?: string; servings?: number; ingredients?: Array<{ name: string; quantity?: number; unit?: string }>; ustensils?: Array<{ name: string; quantity?: number }> }) => {
      try {
        const recipe = await groceriesApi.createRecipe(tripId, data)
        set((state: any) => ({ recipes: [...state.recipes, recipe] }))
        return recipe
      } catch (err: unknown) {
        const message = (err && typeof err === 'object' && 'response' in err && (err as any).response?.data?.error)
          ? (err as any).response.data.error
          : err instanceof Error ? err.message : 'Unknown error'
        throw new Error(`createRecipe failed: ${message}`)
      }
    },

    updateRecipe: async (tripId: number | string, recipeId: number, data: { name?: string; description?: string; servings?: number }) => {
      const updated = await groceriesApi.updateRecipe(tripId, recipeId, data)
      set((state: any) => ({
        recipes: state.recipes.map((r: Recipe) => r.id === recipeId ? updated : r)
      }))
      return updated
    },

    deleteRecipe: async (tripId: number | string, recipeId: number) => {
      await groceriesApi.deleteRecipe(tripId, recipeId)
      set((state: any) => ({
        recipes: state.recipes.filter((r: Recipe) => r.id !== recipeId)
      }))
    },

    addRecipeIngredient: async (tripId: number | string, recipeId: number, data: { name: string; quantity?: number; unit?: string }) => {
      const ingredient = await groceriesApi.addIngredient(tripId, recipeId, data)
      set((state: any) => ({
        recipes: state.recipes.map((r: Recipe) =>
          r.id === recipeId ? { ...r, ingredients: [...r.ingredients, ingredient] } : r
        )
      }))
      return ingredient
    },

    updateRecipeIngredient: async (tripId: number | string, recipeId: number, ingredientId: number, data: { name?: string; quantity?: number; unit?: string }) => {
      const updated = await groceriesApi.updateIngredient(tripId, recipeId, ingredientId, data)
      set((state: any) => ({
        recipes: state.recipes.map((r: Recipe) =>
          r.id === recipeId ? {
            ...r,
            ingredients: r.ingredients.map((i: RecipeIngredient) => i.id === ingredientId ? updated : i)
          } : r
        )
      }))
      return updated
    },

    deleteRecipeIngredient: async (tripId: number | string, recipeId: number, ingredientId: number) => {
      await groceriesApi.deleteIngredient(tripId, recipeId, ingredientId)
      set((state: any) => ({
        recipes: state.recipes.map((r: Recipe) =>
          r.id === recipeId ? {
            ...r,
            ingredients: r.ingredients.filter((i: RecipeIngredient) => i.id !== ingredientId)
          } : r
        )
      }))
    },

    addGroceryItem: async (tripId: number | string, data: { name: string; quantity?: number; unit?: string; domain?: string }) => {
      const item = await groceriesApi.createGroceryItem(tripId, data)
      set((state: any) => {
        const newItems = [...state.groceryItems, item]
        return {
          groceryItems: newItems,
          shoppingListByDomain: buildShoppingListByDomain(newItems)
        }
      })
      return item
    },

    updateGroceryItem: async (tripId: number | string, itemId: number, data: { name?: string; quantity?: number; unit?: string; domain?: string; checked?: boolean }) => {
      const updated = await groceriesApi.updateGroceryItem(tripId, itemId, data)
      set((state: any) => {
        const newItems = state.groceryItems.map((i: GroceryItem) => i.id === itemId ? updated : i)
        return {
          groceryItems: newItems,
          shoppingListByDomain: buildShoppingListByDomain(newItems)
        }
      })
      return updated
    },

    deleteGroceryItem: async (tripId: number | string, itemId: number) => {
      await groceriesApi.deleteGroceryItem(tripId, itemId)
      set((state: any) => {
        const newItems = state.groceryItems.filter((i: GroceryItem) => i.id !== itemId)
        return {
          groceryItems: newItems,
          shoppingListByDomain: buildShoppingListByDomain(newItems)
        }
      })
    },

    addRecipeIngredientsToShoppingList: async (tripId: number | string, recipeId: number, servings?: number) => {
      const items = await groceriesApi.addFromRecipe(tripId, recipeId, servings)
      set((state: any) => {
        const newItems = [...state.groceryItems, ...items]
        return {
          groceryItems: newItems,
          shoppingListByDomain: buildShoppingListByDomain(newItems)
        }
      })
      return items
    },

    toggleGroceryItem: async (tripId: number | string, itemId: number, checked: boolean) => {
      await get().updateGroceryItem(tripId, itemId, { checked })
    },

    // Remote event handlers
    _onRecipeCreated: (recipe: Recipe) => {
      set(state => ({
        recipes: [...state.recipes, recipe],
      }))
    },

    _onRecipeUpdated: (recipe: Recipe) => {
      set(state => ({
        recipes: state.recipes.map(r => (r.id === recipe.id ? recipe : r)),
      }))
    },

    _onRecipeDeleted: (recipeId: number) => {
      set(state => ({
        recipes: state.recipes.filter(r => r.id !== recipeId),
      }))
    },

    _onIngredientCreated: (ingredient: RecipeIngredient, recipeId: number) => {
      set(state => ({
        recipes: state.recipes.map(r =>
          r.id === recipeId
            ? { ...r, ingredients: [...r.ingredients, ingredient] }
            : r
        ),
      }))
    },

    _onIngredientUpdated: (ingredient: RecipeIngredient, recipeId: number) => {
      set(state => ({
        recipes: state.recipes.map(r =>
          r.id === recipeId
            ? {
                ...r,
                ingredients: r.ingredients.map(ing =>
                  ing.id === ingredient.id ? ingredient : ing
                ),
              }
            : r
        ),
      }))
    },

    _onIngredientDeleted: (ingredientId: number, recipeId: number) => {
      set(state => ({
        recipes: state.recipes.map(r =>
          r.id === recipeId
            ? {
                ...r,
                ingredients: r.ingredients.filter(ing => ing.id !== ingredientId),
              }
            : r
        ),
      }))
    },

    _onGroceryItemCreated: (item: GroceryItem) => {
      set(state => {
        const updated = [...state.groceryItems, item]
        return {
          groceryItems: updated,
          shoppingListByDomain: buildShoppingListByDomain(updated),
        }
      })
    },

    _onGroceryItemUpdated: (item: GroceryItem) => {
      set(state => {
        const updated = state.groceryItems.map(i => (i.id === item.id ? item : i))
        return {
          groceryItems: updated,
          shoppingListByDomain: buildShoppingListByDomain(updated),
        }
      })
    },

    _onGroceryItemDeleted: (itemId: number) => {
      set(state => {
        const updated = state.groceryItems.filter(i => i.id !== itemId)
        return {
          groceryItems: updated,
          shoppingListByDomain: buildShoppingListByDomain(updated),
        }
      })
    },

    _onGroceryItemsAdded: (items: GroceryItem[]) => {
      set(state => {
        const updated = [...state.groceryItems, ...items]
        return {
          groceryItems: updated,
          shoppingListByDomain: buildShoppingListByDomain(updated),
        }
      })
    },
  }
}
