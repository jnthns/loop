import { useState } from 'react';
import {
  COUNTRY_OPTIONS,
  FLAVOR_PROFILE_OPTIONS,
  PROTEIN_OPTIONS,
  type Country,
  type FlavorProfile,
  type Protein,
} from '../../lib/recipes/options';
import { BrutalButton, BrutalInput, BrutalSelect } from '../ui';

export type FilterBarValues = {
  protein: Protein;
  countryOfOrigin: Country;
  flavorProfile: FlavorProfile;
  extraIngredients: string;
};

export type FilterBarProps = {
  onGenerate: (filters: FilterBarValues) => void;
  loading?: boolean;
};

export function FilterBar({ onGenerate, loading = false }: FilterBarProps) {
  const [protein, setProtein] = useState<Protein>(PROTEIN_OPTIONS[0].value);
  const [countryOfOrigin, setCountryOfOrigin] = useState<Country>(
    COUNTRY_OPTIONS[0].value,
  );
  const [flavorProfile, setFlavorProfile] = useState<FlavorProfile>(
    FLAVOR_PROFILE_OPTIONS[0].value,
  );
  const [extraIngredients, setExtraIngredients] = useState('');

  const handleGenerate = () => {
    onGenerate({ protein, countryOfOrigin, flavorProfile, extraIngredients });
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <label className="flex flex-col gap-1 font-bold">
          Protein
          <BrutalSelect
            aria-label="Protein"
            value={protein}
            onChange={(event) => setProtein(event.target.value as Protein)}
            disabled={loading}
          >
            {PROTEIN_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </BrutalSelect>
        </label>

        <label className="flex flex-col gap-1 font-bold">
          Country of Origin
          <BrutalSelect
            aria-label="Country of Origin"
            value={countryOfOrigin}
            onChange={(event) =>
              setCountryOfOrigin(event.target.value as Country)
            }
            disabled={loading}
          >
            {COUNTRY_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </BrutalSelect>
        </label>

        <label className="flex flex-col gap-1 font-bold">
          Flavor Profile
          <BrutalSelect
            aria-label="Flavor Profile"
            value={flavorProfile}
            onChange={(event) =>
              setFlavorProfile(event.target.value as FlavorProfile)
            }
            disabled={loading}
          >
            {FLAVOR_PROFILE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </BrutalSelect>
        </label>
      </div>

      <label className="flex flex-col gap-1 font-bold">
        Extra ingredients on hand
        <BrutalInput
          placeholder="Extra ingredients on hand"
          value={extraIngredients}
          onChange={(event) => setExtraIngredients(event.target.value)}
          disabled={loading}
        />
      </label>

      <BrutalButton onClick={handleGenerate} disabled={loading}>
        {loading ? 'Generating…' : 'Generate'}
      </BrutalButton>
    </div>
  );
}
