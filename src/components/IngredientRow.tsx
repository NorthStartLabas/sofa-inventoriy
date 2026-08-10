import type { Ingredient } from '../types'
import { Stepper } from './Stepper'

type Props = {
  ingredient: Ingredient
  quantity: number
  /** Second line — each view fills it with whatever is most useful there. */
  subtitle: string
  onChange: (quantity: number) => void
}

/**
 * One row, used by all three order views. Route, Dish and All differ only in
 * how they group and sort these; a row itself always behaves the same way.
 *
 * Renders an <li>, so the caller supplies the <ul>.
 */
export function IngredientRow({ ingredient, quantity, subtitle, onChange }: Props) {
  return (
    <li
      className={`flex items-center gap-2 border-b border-neutral-200 py-1.5 pr-2 pl-4 ${
        quantity > 0 ? 'bg-emerald-50' : ''
      }`}
    >
      <div className="min-w-0 flex-1">
        <p className={`truncate text-base ${quantity > 0 ? 'font-semibold' : 'font-medium'}`}>
          {ingredient.name}
          {ingredient.archived && (
            <span className="ml-2 font-normal text-amber-700">archived</span>
          )}
        </p>
        {/* Kept even when empty so rows stay the same height down the list. */}
        <p className="text-base text-neutral-500">{subtitle}</p>
      </div>

      <Stepper quantity={quantity} unit={ingredient.unit} onChange={onChange} />
    </li>
  )
}
