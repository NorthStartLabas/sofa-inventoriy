import { useAlready } from '../basket/alreadyContext'
import { summarise } from '../lib/alreadyText'
import type { Ingredient } from '../types'
import { Stepper } from './Stepper'

type Props = {
  ingredient: Ingredient
  quantity: number
  /** Second line — each view fills it with whatever is most useful there. */
  subtitle: string
  /** Tapped, but the change hasn't reached the server yet. */
  unsaved?: boolean
}

/**
 * One row, used by all three order views. Route, Dish and All differ only in
 * how they group and sort these; a row itself always behaves the same way.
 *
 * The stepper writes through `useAlready` rather than straight to the basket,
 * so the "somebody already ordered that" question is asked in one place instead
 * of three. Renders an <li>, so the caller supplies the <ul>.
 */
export function IngredientRow({ ingredient, quantity, subtitle, unsaved }: Props) {
  const already = useAlready()
  const inBasket = quantity > 0
  const warning = already.check(ingredient.id)

  return (
    <li
      // The hover tint isn't an affordance — the row isn't a target, the stepper
      // is. It's a ruler: on a wide screen the name and the stepper are far
      // apart, and this is what keeps your eye on the same line between them.
      className={`mark flex items-center gap-2 border-b border-line py-1.5 pr-2 pl-4 ${
        inBasket ? 'bg-cream hover:brightness-[0.98]' : 'bg-surface hover:bg-paper'
      }`}
    >
      <div className="min-w-0 flex-1">
        <p className={`truncate text-base ${inBasket ? 'font-semibold' : 'font-medium'}`}>
          {ingredient.name}
          {ingredient.archived && (
            <span className="label ml-2 text-base text-bad">archived</span>
          )}
        </p>
        {/* Kept even when empty so rows stay the same height down the list.
            Three things want this slot and they're ranked by urgency: a tap
            that hasn't saved, then somebody else already having it, then
            whatever the view wanted to say. */}
        <p className="truncate text-base text-ink-2">
          {unsaved ? (
            'not saved yet'
          ) : warning ? (
            <span className="text-bad">{summarise(warning, ingredient.unit)}</span>
          ) : (
            subtitle
          )}
        </p>
      </div>

      <Stepper
        quantity={quantity}
        unit={ingredient.unit}
        onChange={(next) => already.step(ingredient.id, quantity, next)}
      />
    </li>
  )
}
