export type Location = {
  id: string
  name: string
  sort_order: number
}

export type Supplier = {
  id: string
  name: string
}

export type Ingredient = {
  id: string
  name: string
  unit: string
  location_id: string
  supplier_id: string | null
  sort_order: number
  archived: boolean
}

export type Dish = {
  id: string
  name: string
}

export type DishIngredient = {
  dish_id: string
  ingredient_id: string
}

export type Catalog = {
  locations: Location[]
  suppliers: Supplier[]
  ingredients: Ingredient[]
  dishes: Dish[]
  dishIngredients: DishIngredient[]
}

export const emptyCatalog: Catalog = {
  locations: [],
  suppliers: [],
  ingredients: [],
  dishes: [],
  dishIngredients: [],
}
