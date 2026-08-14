import type { Ingredient } from '../types'
import { Stepper } from './Stepper'

type Props = {
  ingredient: Ingredient
  quantity: number
  /** Second line — each view fills it with whatever is most useful there. */
  subtitle: string
  /** Tapped, but the change hasn't reached the server yet. */
  unsaved?: boolean
  onChange: (quantity: number) => void
}

/**
 * One row, used by all three order views. Route, Dish and All differ only in
 * how they group and sort these; a row itself always behaves the same way.
 *
 * Renders an <li>, so the caller supplies the <ul>.
 */
export function IngredientRow({ ingredient, quantity, subtitle, unsaved, onChange }: Props) {
  const inBasket = quantity > 0

  return (
    <li
      // The hover tint isn't an affordance — the row isn't a target, the stepper
      // is. It's a ruler: on a wide screen the name and the stepper are far
      // apart, and this is what keeps your eye on the same line between them.
      className={`mark flex items-center gap-2 border-b border-rule py-1.5 pr-2 pl-4 ${
        inBasket ? 'bg-apricot hover:brightness-95' : 'bg-surface hover:bg-sand'
      }`}
    >
      <div className="min-w-0 flex-1">
        <p className={`truncate text-base ${inBasket ? 'font-semibold' : 'font-medium'}`}>
          {ingredient.name}
          {ingredient.archived && (
            <span className="label ml-2 text-base text-flag">archived</span>
          )}
        </p>
        {/* Kept even when empty so rows stay the same height down the list.
            The unsaved note takes the slot over rather than adding a line,
            because it's the more urgent of the two things it could say. */}
        <p className="truncate text-base text-stone">
          {unsaved ? 'not saved yet' : subtitle}
        </p>
      </div>

      <Stepper quantity={quantity} unit={ingredient.unit} onChange={onChange} />
    </li>
  )
}
