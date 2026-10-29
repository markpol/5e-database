import { z } from 'zod';
import {
  APIReferenceSchema,
  ChoiceSchema,
  DamageSchema,
  DifficultyClassSchema,
  translatable,
} from '../../schemas/common';

const MonsterSpeedSchema = z.strictObject({
  walk: z.number().optional(),
  burrow: z.number().optional(),
  climb: z.number().optional(),
  fly: z.number().optional(),
  swim: z.number().optional(),
  hover: z.boolean().optional(),
});

const SenseSchema = z.strictObject({
  passive_perception: z.number(),
  blindsight: z.number().optional(),
  // Reduced blindsight range while the creature is deafened (Grimlock).
  blindsight_deafened: z.number().optional(),
  darkvision: z.number().optional(),
  tremorsense: z.number().optional(),
  truesight: z.number().optional(),
  blindsight_blind_beyond: z.boolean().optional(),
});

const MonsterProficiencySchema = z.strictObject({
  value: z.number(),
  proficiency: APIReferenceSchema,
});

const MonsterArmorClassSchema = z.strictObject({
  type: z.string(),
  value: z.number(),
  armor: z.array(APIReferenceSchema).optional(),
  condition: APIReferenceSchema.optional(),
  spell: APIReferenceSchema.optional(),
  desc: translatable(z.string()).optional(),
});

const ActionUsageSchema = z.strictObject({
  type: z.string(),
  dice: z.string().optional(),
  min_value: z.number().optional(),
  times: z.number().optional(),
  rest_types: z.array(z.string()).optional(),
});

const ConditionDurationSchema = z.strictObject({
  length: z.number(),
  unit: z.string(),
  interrupt: z.string().optional(),
  interrupt_modifier: z.string().optional(),
});

const AppliedConditionSchema = z.strictObject({
  condition_type: APIReferenceSchema,
  duration: ConditionDurationSchema,
});

const GrappleSchema = z.strictObject({
  escape_dc_value: z.number(),
  additional_condition: z
    .strictObject({
      condition_type: APIReferenceSchema,
      duration: ConditionDurationSchema,
    })
    .optional(),
});

const MonsterDamageSchema = z.union([
  DamageSchema.extend({
    grapple: GrappleSchema.optional(),
    dc: DifficultyClassSchema.optional(),
    condition: AppliedConditionSchema.optional(),
  }),
  z.strictObject({ grapple: GrappleSchema }),
  z.strictObject({ dc: DifficultyClassSchema.optional(), condition: AppliedConditionSchema }),
]);

const MonsterActionItemSchema = z.strictObject({
  action_name: z.string(),
  // Counts are numeric except hydra ("Number of Heads") and violet-fungus ("1d4"), which are not fixed counts.
  count: z.union([z.number(), z.string()]),
  type: z.string(),
});

const MonsterActionSituationSchema = z.strictObject({
  target: z.strictObject({
    condition: APIReferenceSchema,
    max_size: z.enum(['Small', 'Medium']).optional(),
    conditionExcludes: z.boolean().optional(),
  }),
});

const MonsterAttackSchema = z.strictObject({
  name: translatable(z.string()),
  dc: DifficultyClassSchema,
  damage: z.array(MonsterDamageSchema).optional(),
});

const MonsterActionSchema = z.strictObject({
  // Added fields: these are not SRD text. Supply counts are chosen defaults and are not in the book.
  name: translatable(z.string()),
  desc: translatable(z.string()),
  attack_type: z.enum(['Melee', 'Ranged']).optional(),
  preference: z
    .strictObject({
      type: z.enum(['always until first hit', 'always on first round', 'always unless target has condition']),
      target_condition: APIReferenceSchema.optional(),
    })
    .optional(),
  situation: MonsterActionSituationSchema.optional(),
  condition: z
    .strictObject({ condition_type: APIReferenceSchema, duration: ConditionDurationSchema })
    .optional(),
  attack_bonus: z.number().optional(),
  weapon: z.string().optional(),
  weapon_kind: z.enum(['natural', 'manufactured', 'spell']).optional(),
  supply: z.strictObject({ item: z.string(), count: z.number() }).optional(),
  dc: DifficultyClassSchema.optional(),
  usage: ActionUsageSchema.optional(),
  multiattack_type: z.string().optional(),
  actions: z.array(MonsterActionItemSchema).optional(),
  action_options: ChoiceSchema.optional(),
  attacks: z.array(MonsterAttackSchema).optional(),
  options: ChoiceSchema.optional(),
  damage: z.array(z.union([MonsterDamageSchema, ChoiceSchema])).optional(),
});

const LegendaryActionSchema = z.strictObject({
  name: translatable(z.string()),
  desc: translatable(z.string()),
  attack_bonus: z.number().optional(),
  damage: z.array(MonsterDamageSchema).optional(),
  dc: DifficultyClassSchema.optional(),
});

const ReactionSchema = z.strictObject({
  name: translatable(z.string()),
  desc: translatable(z.string()),
  dc: DifficultyClassSchema.optional(),
});

const SpecialAbilityUsageSchema = z.strictObject({
  type: z.string(),
  times: z.number().optional(),
  rest_types: z.array(z.string()).optional(),
});

const SpellcastingSpellUsageSchema = z.strictObject({
  type: z.string(),
  times: z.number().optional(),
});

const SpellcastingSpellSchema = z.strictObject({
  name: z.string(),
  level: z.number(),
  url: z.string(),
  usage: SpellcastingSpellUsageSchema.optional(),
  notes: z.string().optional(),
});

const SpellcastingSchema = z.strictObject({
  ability: APIReferenceSchema,
  components_required: z.array(z.string()),
  spells: z.array(SpellcastingSpellSchema),
  level: z.number().optional(),
  dc: z.number().optional(),
  modifier: z.number().optional(),
  school: z.string().optional(),
  slots: z.record(z.string(), z.number()).optional(),
});

const SpecialAbilitySchema = z.strictObject({
  name: translatable(z.string()),
  desc: translatable(z.string()),
  attack_bonus: z.number().optional(),
  damage: z.array(MonsterDamageSchema).optional(),
  dc: DifficultyClassSchema.optional(),
  usage: SpecialAbilityUsageSchema.optional(),
  spellcasting: SpellcastingSchema.optional(),
  bonus_action: z.strictObject({
    action: z.string(),
    situation: z.strictObject({
      target: z.strictObject({ condition: APIReferenceSchema }),
    }),
  }).optional(),
  relentless_max_damage: z.number().optional(),
});

export const MonsterSchema = z.strictObject({
  index: z.string(),
  name: translatable(z.string()),
  desc: translatable(z.string()).optional(),
  size: translatable(z.string()),
  type: translatable(z.string()),
  subtype: translatable(z.string()).optional(),
  alignment: translatable(z.string()),
  armor_class: z.array(MonsterArmorClassSchema),
  hit_points: z.number(),
  hit_dice: z.string(),
  hit_points_roll: z.string(),
  speed: MonsterSpeedSchema,
  strength: z.number(),
  dexterity: z.number(),
  constitution: z.number(),
  intelligence: z.number(),
  wisdom: z.number(),
  charisma: z.number(),
  proficiencies: z.array(MonsterProficiencySchema),
  damage_vulnerabilities: z.array(z.string()),
  damage_resistances: z.array(z.string()),
  damage_immunities: z.array(z.string()),
  condition_immunities: z.array(APIReferenceSchema),
  senses: SenseSchema,
  languages: translatable(z.string()),
  challenge_rating: z.number(),
  proficiency_bonus: z.number().optional(),
  xp: z.number(),
  special_abilities: z.array(SpecialAbilitySchema).optional(),
  actions: z.array(MonsterActionSchema).optional(),
  legendary_actions: z.array(LegendaryActionSchema).optional(),
  reactions: z.array(ReactionSchema).optional(),
  environments: z.string().optional(),
  bonus_actions: z.array(z.string()).optional(),
  forms: z.array(APIReferenceSchema).optional(),
  image: z.string().optional(),
  url: z.string(),
});
