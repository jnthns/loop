/** Dropdown option values per specs/spec.md §9 */

export const PROTEINS = [
  'Chicken',
  'Beef',
  'Pork',
  'Fish',
  'Tofu',
  'Lamb',
  'Shrimp',
  'Eggs',
] as const;

export const COUNTRIES = [
  'Italian',
  'Mexican',
  'Japanese',
  'Indian',
  'Thai',
  'French',
  'Korean',
  'Moroccan',
  'American',
  'Greek',
] as const;

export const FLAVOR_PROFILES = [
  'Spicy',
  'Savory',
  'Sweet',
  'Tangy',
  'Smoky',
  'Herbaceous',
  'Umami',
  'Mild',
] as const;

export type Protein = (typeof PROTEINS)[number];
export type Country = (typeof COUNTRIES)[number];
export type FlavorProfile = (typeof FLAVOR_PROFILES)[number];

export type SelectOption<T extends string> = {
  value: T;
  label: string;
};

export const PROTEIN_OPTIONS: SelectOption<Protein>[] = PROTEINS.map(
  (value) => ({ value, label: value }),
);

export const COUNTRY_OPTIONS: SelectOption<Country>[] = COUNTRIES.map(
  (value) => ({ value, label: value }),
);

export const FLAVOR_PROFILE_OPTIONS: SelectOption<FlavorProfile>[] =
  FLAVOR_PROFILES.map((value) => ({ value, label: value }));
