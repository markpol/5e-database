import fs from "fs";
import srcMonsters from './5e-SRD-Monsters.json';
console.log(`Loaded ${srcMonsters.length} monsters to normalize from 5e-SRD-Monsters.json`);

const outputFilePath = "./5e-SRD-Monsters-Normalized-6.json";
type Monster = Partial<typeof srcMonsters[number]>

function normalizeDamage(damage: any) {
  console.log(`            Normalizing damage: ${damage.damage_dice}`);
  if (damage.dc?.dc_type?.index) {
    console.log(`                Replacing dc_type object ${damage.dc.dc_type.index} to simple index`);
    damage.dc.dc_type = damage.dc.dc_type.index;
  }
  if (damage.damage_type?.index) {
    console.log(`                Replacing damage_type object ${damage.damage_type.index} to simple index`);
    damage.damage_type = damage.damage_type.index;
  }
  if (damage.condition?.condition_type?.index) {
    console.log(`                Replacing condition_type object ${damage.condition.condition_type.index} to simple index`);
    damage.condition.condition_type = damage.condition.condition_type.index;
  }
  if (damage.grapple?.additional_condition?.condition_type?.index) {
    console.log(`                Replacing additional_condition object ${damage.grapple.additional_condition.condition_type.index} to simple index`);
    damage.grapple.additional_condition.condition_type = damage.grapple.additional_condition.condition_type.index;
  }
  if (damage.from?.options?.length) {
    damage.from.options = damage.from.options.map(normalizeDamage);
  }
  return {...damage};
}

function normalizeAction(action: any) {
  console.log(`        Normalizing action: ${action.name}`);
  if (action.dc) {
    if (action.damage?.length) {
      if (!("dc" in action.damage[action.damage.length - 1])) {
        console.log(`            Moving DC: ${action.dc?.dc_type} to damage object number: ${action.damage.length - 1}`);
        action.damage[action.damage.length - 1]["dc"] = {
          ...action.dc,
        };
        delete action.dc;
      }
    } else {
      console.log(`            Creating damage object and moving DC: ${action.dc?.dc_type} to it`);
      action["damage"] = [{
        dc: { ...action.dc },
      }] as any;
      delete action.dc;
    }
  }
  if ("condition" in action) {
    if ("damage" in action && action.damage?.length) {
      if (!("condition" in action.damage[action.damage.length - 1])) {
        console.log(`            Moving Condition: ${action.condition?.condition_type} to damage object number: ${action.damage.length - 1}`);
        action.damage[action.damage.length - 1]["condition"] = {
          ...action.condition,
        };
        delete action.condition;
      }
    } else {
      console.log(`            Creating damage object and moving Condition: ${action.condition?.condition_type} to it`);
      action["damage"] = [{
        condition: { ...action.condition },
      }] as any;
      delete action.condition;
    }
  }
  if (action.options?.from?.options?.length) {
    action.options.from.options = action.options.from.options.map((option: any) => {
      if (option.damage?.length) {
        option.damage = option.damage.map(normalizeDamage);
      }
      return normalizeDamage(option);
    });
  }
  if (action.attacks?.length) {
    action.attacks = action.attacks.map((attack) => {
      if (attack.damage?.length) {
        attack.damage = attack.damage.map(normalizeDamage);
      }
      return normalizeDamage(attack);
    });
  }
  if (action.situation?.target?.condition?.index) {
    console.log(`            Replacing condition object ${action.situation.target.condition.index} to simple index`);
    action.situation.target.condition = action.situation.target.condition.index;
  }
  if (action.preference?.target_condition?.index) {
    console.log(`            Replacing condition object ${action.preference.target_condition.index} to simple index`);
    action.preference.target_condition = action.preference.target_condition.index;
  }

  const normalizedAction = {
    ...action,
    damage: action.damage?.map(normalizeDamage),
  };

  return normalizedAction;
}

function normalizeSpecialAbility(specialAbility: any) {
  console.log(`        Normalizing special ability: ${specialAbility.name}`);
  if (specialAbility.dc?.dc_type?.index) {
    console.log(`            Replacing dc_type object ${specialAbility.dc.dc_type.index} to simple index`);
    specialAbility.dc.dc_type = specialAbility.dc.dc_type.index;
  }
  if (specialAbility.spellcasting?.ability?.index) {
    console.log(`            Replacing spellcasting ability object ${specialAbility.spellcasting.ability.index} to simple index`);
    specialAbility.spellcasting.ability = specialAbility.spellcasting.ability.index;
  }
  if (specialAbility.damage?.length) {
    specialAbility.damage = specialAbility.damage.map(normalizeDamage);
  }
  if (specialAbility.bonus_action?.situation?.target?.condition?.index) {
    console.log(`            Replacing condition object ${specialAbility.bonus_action.situation.target.condition.index} to simple index`);
    specialAbility.bonus_action.situation.target.condition = specialAbility.bonus_action.situation.target.condition.index;
  }

  const normalizedSpecialAbility = {
    ...specialAbility,
  };

  return normalizedSpecialAbility;
} 

function normalizeMonster(monster: Monster) {
  console.log(`    Normalizing monster: ${monster.name}`);

  if (monster.proficiencies?.length) {
    monster.proficiencies = monster.proficiencies.map((p) => {
      const name = p.proficiency.name;
      const index = p.proficiency.index;
      console.log(`        Normalizing proficiency: ${name}`);
      return {
        ...p,
        proficiency: index,
      };
    });
  }
  if (monster.condition_immunities?.length) {
    monster.condition_immunities = monster.condition_immunities.map((condition) => {
      console.log(`        Normalizing condition immunity: ${condition.name}`);
      return condition.index;
    });
  }
  if (monster.forms?.length) {
    monster.forms = monster.forms.map((form) => {
      console.log(`        Normalizing form: ${form.name}`);
      return form.index as any;
    });
  }
  if (monster.special_abilities) {
    monster.special_abilities = monster.special_abilities.map(normalizeSpecialAbility);
  }
  if (monster.legendary_actions) {
    monster.legendary_actions = monster.legendary_actions.map(normalizeSpecialAbility);
  }
  if (monster.armor_class?.length) {
    monster.armor_class = monster.armor_class.map((ac) => {
      if (ac.condition?.index) {
        console.log(`        Replacing condition object ${ac.condition.index} to simple index`);
        ac.condition = ac.condition.index;
      }
      if (ac.armor?.length) {
        ac.armor = ac.armor.map((armor) => {
          if (armor?.index) {
            console.log(`            Replacing armor object ${armor.index} to simple index`);
            return armor.index;
          }
          return armor;
        });
      }
      if (ac.spell?.index) {
        console.log(`        Replacing spell object ${ac.spell.index} to simple index`);
        ac.spell = ac.spell.index;
      }
      return ac;
    });  
  }
  if (monster.reactions?.length) {
    monster.reactions = monster.reactions.map(normalizeDamage);
  } 
  const normalizedMonster = {
    ...monster,
    actions: monster.actions?.map(normalizeAction),
  };

  return normalizedMonster;
}

async function writeMonstersToFile() {
  const normalizedMonsters = (srcMonsters as Monster[]).map(normalizeMonster);

  console.log(`Writing ${normalizedMonsters.length} normalized monsters to ${outputFilePath}`);
  await fs.promises.writeFile(outputFilePath, JSON.stringify(normalizedMonsters, null, 2));
}

writeMonstersToFile();