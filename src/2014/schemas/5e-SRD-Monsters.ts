import { z } from 'zod';
import {
  APIReferenceSchema,
  ChoiceSchema,
  DifficultyClassSchema,
} from '../../schemas/common';

const MonsterSpeedSchema = z.strictObject({
  walk: z.union([z.string(), z.number()]).optional(),
  burrow: z.union([z.string(), z.number()]).optional(),
  climb: z.union([z.string(), z.number()]).optional(),
  fly: z.union([z.string(), z.number()]).optional(),
  swim: z.union([z.string(), z.number()]).optional(),
  hover: z.boolean().optional(),
});

const SenseSchema = z.strictObject({
  passive_perception: z.number(),
  blindsight: z.union([z.string(), z.number()]).optional(),
  darkvision: z.union([z.string(), z.number()]).optional(),
  tremorsense: z.union([z.string(), z.number()]).optional(),
  truesight: z.union([z.string(), z.number()]).optional(),
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
  desc: z.string().optional(),
});

const ActionUsageSchema = z.strictObject({
  type: z.string(),
  dice: z.string().optional(),
  min_value: z.number().optional(),
  times: z.number().optional(),
  rest_types: z.array(z.string()).optional(),
});

const MonsterActionItemSchema = z.strictObject({
  action_name: z.string(),
  count: z.union([z.number(), z.string()]),
  type: z.string(),
});

const MonsterDamageSchema = z.strictObject({
  damage_type: APIReferenceSchema.optional(),
  damage_dice: z.string().optional(),
  dc: DifficultyClassSchema.optional(),
  condition: z.record(z.string(), z.unknown()).optional(),
  grapple: z.record(z.string(), z.unknown()).optional(),
});

const MonsterAttackSchema = z.strictObject({
  name: z.string(),
  dc: DifficultyClassSchema,
  damage: z.array(MonsterDamageSchema).optional(),
});

const MonsterActionSchema = z.strictObject({
  // Engine annotations: these fields are not SRD text. Supply counts are engine defaults and are not in the book.
  name: z.string(),
  desc: z.string(),
  attack_bonus: z.number().optional(),
  dc: DifficultyClassSchema.optional(),
  condition: z.record(z.string(), z.unknown()).optional(),
  usage: ActionUsageSchema.optional(),
  multiattack_type: z.string().optional(),
  actions: z.array(MonsterActionItemSchema).optional(),
  action_options: ChoiceSchema.optional(),
  attacks: z.array(MonsterAttackSchema).optional(),
  options: ChoiceSchema.optional(),
  damage: z.array(z.union([MonsterDamageSchema, ChoiceSchema])).optional(),
  weapon: z.string().optional(),
  attack_type: z.string().optional(),
  weapon_kind: z.enum(['natural', 'manufactured', 'spell']).optional(),
  supply: z.strictObject({ item: z.string(), count: z.number() }).optional(),
  preference: z.record(z.string(), z.unknown()).optional(),
  situation: z.record(z.string(), z.unknown()).optional(),
});

const LegendaryActionSchema = z.strictObject({
  name: z.string(),
  desc: z.string(),
  attack_bonus: z.number().optional(),
  damage: z.array(MonsterDamageSchema).optional(),
  dc: DifficultyClassSchema.optional(),
});

const ReactionSchema = z.strictObject({
  name: z.string(),
  desc: z.string(),
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
  name: z.string(),
  desc: z.string(),
  attack_bonus: z.number().optional(),
  damage: z.array(MonsterDamageSchema).optional(),
  dc: DifficultyClassSchema.optional(),
  usage: SpecialAbilityUsageSchema.optional(),
  spellcasting: SpellcastingSchema.optional(),
  relentless_max_damage: z.number().optional(),
  bonus_action: z.record(z.string(), z.unknown()).optional(),
});

export const MonsterSchema = z.strictObject({
  index: z.string(),
  name: z.string(),
  desc: z.string().optional(),
  size: z.string(),
  type: z.string(),
  subtype: z.string().optional(),
  alignment: z.string(),
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
  languages: z.string(),
  challenge_rating: z.number(),
  proficiency_bonus: z.number().optional(),
  xp: z.number(),
  special_abilities: z.array(SpecialAbilitySchema).optional(),
  actions: z.array(MonsterActionSchema).optional(),
  legendary_actions: z.array(LegendaryActionSchema).optional(),
  reactions: z.array(ReactionSchema).optional(),
  forms: z.array(APIReferenceSchema).optional(),
  image: z.string().optional(),
  url: z.string(),
  environments: z.string().optional(),
  bonus_actions: z.array(z.string()).optional(),
});
