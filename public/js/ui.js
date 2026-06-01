const state = {
  unitsByTeam: {
    A: [],
    B: [],
  },
  techIdsByTeam: {
    A: new Set(),
    B: new Set(),
  },
  techCatalogByTeam: {
    A: new Map(),
    B: new Map(),
  },
  unitTechCatalogByTeam: {
    A: new Map(),
    B: new Map(),
  },
  selectedUnits: {
    A: [],
    B: [],
  },
  selectedTechs: {
    A: [],
    B: [],
  },
  selectedUnitTechsByUnit: {
    A: new Map(),
    B: new Map(),
  },
  activeUnitTechDialog: null,
  activeUnitStratDialog: null,
  civByAbbr: {},
};

const CIV_BANNER_MANIFEST_URL = 'https://static.aoe4world.com/vite/manifest.json';
const CIV_BANNER_ALIASES = {
  gol: 'goldenhorde',
  mac: 'macedonian',
  sen: 'sengoku',
  tug: 'tughlaq',
  zx: 'zhuxi',
};

const TECH_TREE_OPTIONS = [
  {
    key: 'melee-attack-1',
    label: 'Melee Attack I',
    group: 'Melee Attack',
    minAge: 1,
    requiresAnyTechIds: ['bloomery', 'tatara'],
    shortDescription: '+1 danno melee',
  },
  {
    key: 'melee-attack-2',
    label: 'Melee Attack II',
    group: 'Melee Attack',
    minAge: 2,
    requiresAnyTechIds: ['decarbonization', 'hizukuri'],
    shortDescription: '+1 danno melee',
  },
  {
    key: 'melee-attack-3',
    label: 'Melee Attack III',
    group: 'Melee Attack',
    minAge: 3,
    requiresAnyTechIds: ['damascus-steel', 'kobuse-gitae'],
    shortDescription: '+1 danno melee',
  },
  {
    key: 'melee-attack-4',
    label: 'Melee Attack IV',
    group: 'Melee Attack',
    minAge: 4,
    requiresAnyTechIds: ['yaki-ire'],
    shortDescription: '+1 danno melee',
  },
  {
    key: 'melee-defense-1',
    label: 'Melee Defense I',
    group: 'Melee Defense',
    minAge: 2,
    requiresAnyTechIds: ['fitted-leatherwork'],
    shortDescription: '+1 armor melee',
  },
  {
    key: 'melee-defense-2',
    label: 'Melee Defense II',
    group: 'Melee Defense',
    minAge: 3,
    requiresAnyTechIds: ['insulated-helm'],
    shortDescription: '+1 armor melee',
  },
  {
    key: 'melee-defense-3',
    label: 'Melee Defense III',
    group: 'Melee Defense',
    minAge: 4,
    requiresAnyTechIds: ['master-smiths'],
    shortDescription: '+1 armor melee',
  },
  {
    key: 'ranged-attack-1',
    label: 'Ranged Attack I',
    group: 'Ranged Attack',
    minAge: 2,
    requiresAnyTechIds: ['steeled-arrow'],
    shortDescription: '+1 danno archi e balestre',
  },
  {
    key: 'ranged-attack-2',
    label: 'Ranged Attack II',
    group: 'Ranged Attack',
    minAge: 3,
    requiresAnyTechIds: ['balanced-projectiles'],
    shortDescription: '+1 danno archi e balestre',
  },
  {
    key: 'ranged-attack-3',
    label: 'Ranged Attack III',
    group: 'Ranged Attack',
    minAge: 4,
    requiresAnyTechIds: ['platecutter-point'],
    shortDescription: '+1 danno archi e balestre',
  },
  {
    key: 'ranged-defense-1',
    label: 'Ranged Defense I',
    group: 'Ranged Defense',
    minAge: 2,
    requiresAnyTechIds: ['iron-undermesh'],
    shortDescription: '+1 armor ranged',
  },
  {
    key: 'ranged-defense-2',
    label: 'Ranged Defense II',
    group: 'Ranged Defense',
    minAge: 3,
    requiresAnyTechIds: ['wedge-rivets'],
    shortDescription: '+1 armor ranged',
  },
  {
    key: 'ranged-defense-3',
    label: 'Ranged Defense III',
    group: 'Ranged Defense',
    minAge: 4,
    requiresAnyTechIds: ['angled-surfaces'],
    shortDescription: '+1 armor ranged',
  },
  {
    key: 'university-incendiary-arrows',
    label: 'Incendiary Arrows',
    group: 'University',
    minAge: 4,
    requiresAnyTechIds: ['incendiary-arrows'],
    shortDescription: '+20% danno ranged non-gunpowder',
  },
  {
    key: 'university-cavalry-biology',
    label: 'Biology / Royal Bloodlines',
    group: 'University',
    minAge: 4,
    requiresAnyTechIds: ['biology', 'royal-bloodlines'],
    shortDescription: '+25% HP cavalleria',
  },
  {
    key: 'university-elite-army-tactics',
    label: 'Elite Army Tactics',
    group: 'University',
    minAge: 4,
    requiresAnyTechIds: ['elite-army-tactics'],
    shortDescription: '+15% HP e danno fanteria melee',
  },
  {
    key: 'university-archer-speed',
    label: 'Archer Speed Rate',
    group: 'University',
    minAge: 4,
    shortDescription: '-15% attack speed ranged',
  },
];

const GENERIC_TECH_IDS = new Set(
  TECH_TREE_OPTIONS
    .flatMap((option) => (Array.isArray(option.requiresAnyTechIds) ? option.requiresAnyTechIds : []))
);

const templates = [
  {
    id: 't1',
    label: '1) EN age2 spear+longbow vs FR knight+archer',
    environment: 'dry-arabia',
    teamA: {
      civHint: 'english',
      age: 2,
      formation: 'normal',
      strategy: 'straight',
      units: [
        { count: 40, preferredIds: ['hardened-spearman', 'spearman'], keywords: ['spearman'] },
        { count: 40, preferredIds: ['longbowman'], keywords: ['longbow'] },
      ],
    },
    teamB: {
      civHint: 'french',
      age: 2,
      formation: 'normal',
      strategy: 'straight',
      units: [
        { count: 20, preferredIds: ['royal-knight', 'knight'], keywords: ['knight'] },
        { count: 40, preferredIds: ['archer'], keywords: ['archer'] },
      ],
    },
  },
  {
    id: 't2',
    label: '2) JP age3 mounted samurai vs FR knight',
    environment: 'dry-arabia',
    teamA: {
      civHint: 'japanese',
      age: 3,
      formation: 'normal',
      strategy: 'straight',
      units: [
        { count: 20, preferredIds: ['mounted-samurai'], keywords: ['mounted', 'samurai'] },
      ],
    },
    teamB: {
      civHint: 'french',
      age: 3,
      formation: 'normal',
      strategy: 'straight',
      units: [
        { count: 20, preferredIds: ['royal-knight', 'knight'], keywords: ['knight'] },
      ],
    },
  },
  {
    id: 't3',
    label: '3) EN age3 maa+longbow vs FR horseman+arbaletrier',
    environment: 'dry-arabia',
    teamA: {
      civHint: 'english',
      age: 3,
      formation: 'normal',
      strategy: 'straight',
      units: [
        { count: 40, preferredIds: ['man-at-arms', 'early-man-at-arms'], keywords: ['man', 'arms'] },
        { count: 40, preferredIds: ['longbowman'], keywords: ['longbow'] },
      ],
    },
    teamB: {
      civHint: 'french',
      age: 3,
      formation: 'normal',
      strategy: 'straight',
      units: [
        { count: 25, preferredIds: ['horseman'], keywords: ['horseman'] },
        { count: 40, preferredIds: ['arbaletrier', 'crossbowman'], keywords: ['arbal', 'crossbow'] },
      ],
    },
  },
  {
    id: 't4',
    label: '4) HRE age4 maa+handcannoneer vs ABB knight+archer',
    environment: 'dry-arabia',
    teamA: {
      civHint: 'holy roman empire',
      age: 4,
      formation: 'normal',
      strategy: 'straight',
      units: [
        { count: 40, preferredIds: ['man-at-arms', 'early-man-at-arms'], keywords: ['man', 'arms'] },
        { count: 40, preferredIds: ['handcannoneer'], keywords: ['hand', 'cannon'] },
      ],
    },
    teamB: {
      civHint: 'abbasid dynasty',
      age: 4,
      formation: 'normal',
      strategy: 'straight',
      units: [
        { count: 40, preferredIds: ['lancer', 'knight'], keywords: ['lancer'] },
        { count: 50, preferredIds: ['archer'], keywords: ['archer'] },
      ],
    },
  },
  {
    id: 't5',
    label: '5) HRE age2 spear+horseman vs FR knight+archer',
    environment: 'dry-arabia',
    teamA: {
      civHint: 'holy roman empire',
      age: 2,
      formation: 'normal',
      strategy: 'straight',
      units: [
        { count: 40, preferredIds: ['hardened-spearman', 'spearman'], keywords: ['spearman'] },
        { count: 40, preferredIds: ['horseman'], keywords: ['horseman'] },
      ],
    },
    teamB: {
      civHint: 'french',
      age: 2,
      formation: 'normal',
      strategy: 'straight',
      units: [
        { count: 20, preferredIds: ['royal-knight', 'knight'], keywords: ['knight'] },
        { count: 40, preferredIds: ['archer'], keywords: ['archer'] },
      ],
    },
  },
  {
    id: 't6',
    label: '6) Test kiting: EN longbow age2 vs FR archer age2',
    environment: 'dry-arabia',
    teamA: {
      civHint: 'english',
      age: 2,
      formation: 'normal',
      strategy: 'kiting',
      units: [
        { count: 1, preferredIds: ['longbowman'], keywords: ['longbow'] },
      ],
    },
    teamB: {
      civHint: 'french',
      age: 2,
      formation: 'normal',
      strategy: 'straight',
      units: [
        { count: 1, preferredIds: ['archer'], keywords: ['archer'] },
      ],
    },
  },
];

function byId(id) {
  return document.getElementById(id);
}

function teamElements(team) {
  return {
    civ: byId(`team${team}-civ`),
    civIcon: byId(`team${team}-civ-icon`),
    age: byId(`team${team}-age`),
    formation: byId(`team${team}-formation`),
    techButton: byId(`team${team}-tech-btn`),
    techSummary: byId(`team${team}-tech-summary`),
    techDialog: byId(`team${team}-tech-dialog`),
    techOptions: byId(`team${team}-tech-options`),
    techClear: byId(`team${team}-tech-clear`),
    techSelectAll: byId(`team${team}-tech-select-all`),
    techApply: byId(`team${team}-tech-apply`),
    unitIcon: byId(`team${team}-unit-icon`),
    unitSelect: byId(`team${team}-unit-select`),
    unitCount: byId(`team${team}-unit-count`),
    unitAttackModeWrap: byId(`team${team}-unit-attack-mode-wrap`),
    unitAttackMode: byId(`team${team}-unit-attack-mode`),
    resourceSummary: byId(`team${team}-resource-summary`),
    unitList: byId(`team${team}-unit-list`),
  };
}

function otherTeam(team) {
  return team === 'A' ? 'B' : 'A';
}

function isBannedUnit(unit) {
  const id = String(unit.id || '').toLowerCase();
  const name = String(unit.name || '').toLowerCase();
  const classes = [
    ...(Array.isArray(unit.classes) ? unit.classes : []),
    ...(Array.isArray(unit.displayClasses) ? unit.displayClasses : []),
  ]
    .map((c) => String(c).toLowerCase())
    .join(' ');

  const navalPattern = /\b(ship|boat|naval|war\s*cog|hulk|galley|demolition\s*ship|dhow|junk|fishing|transport)\b/;
  const siegePattern = /\b(siege|mangonel|trebuchet|bombard|springald|ribauldequin|culverin|traction\s*trebuchet|nest\s*of\s*bees|great\s*bombard|cannon|battering\s*ram)\b/;
  const bannedPattern = /\b(villager|scout|king|battering\s*ram|demolition\s*ship|galley|hulk)\b/;

  return (
    bannedPattern.test(id) ||
    bannedPattern.test(name) ||
    navalPattern.test(id) ||
    navalPattern.test(name) ||
    navalPattern.test(classes) ||
    siegePattern.test(id) ||
    siegePattern.test(name) ||
    siegePattern.test(classes)
  );
}

async function getJson(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Request failed: ${response.status}`);
  }
  return response.json();
}

function getTeamAge(team) {
  return parseInt(teamElements(team).age.value || '1', 10);
}

function resolveBiologyLabel(team) {
  const techSet = state.techIdsByTeam[team] || new Set();
  return techSet.has('royal-bloodlines') ? 'Royal Bloodlines' : 'Biology';
}

function resolveTechMeta(team, id) {
  const catalog = state.techCatalogByTeam[team];
  return catalog ? catalog.get(id) : null;
}

function resolveOptionTechMeta(team, option) {
  if (!option.requiresAnyTechIds || option.requiresAnyTechIds.length === 0) {
    return null;
  }

  for (const id of option.requiresAnyTechIds) {
    const meta = resolveTechMeta(team, id);
    if (meta) {
      return meta;
    }
  }

  return null;
}

function resolveTechTreeOptions(team) {
  const age = getTeamAge(team);
  const techSet = state.techIdsByTeam[team] || new Set();

  return TECH_TREE_OPTIONS.map((option) => {
    const optionTechMeta = resolveOptionTechMeta(team, option);
    const resolvedMinAge = optionTechMeta && typeof optionTechMeta.age === 'number'
      ? optionTechMeta.age
      : option.minAge;
    const availableByAge = age >= resolvedMinAge;
    const availableByCiv = !option.requiresAnyTechIds
      || option.requiresAnyTechIds.some((id) => techSet.has(id));

    const resolvedLabel = option.key === 'university-cavalry-biology'
      ? resolveBiologyLabel(team)
      : (optionTechMeta && option.group !== 'University' ? optionTechMeta.name : option.label);

    return {
      ...option,
      minAge: resolvedMinAge,
      label: resolvedLabel,
      available: (age >= resolvedMinAge) && availableByCiv,
      reason: !availableByAge
        ? `Richiede Eta ${resolvedMinAge}`
        : (!availableByCiv ? 'Non disponibile per questa civilta' : ''),
    };
  });
}

function sanitizeTeamTechSelections(team) {
  const available = new Set(
    resolveTechTreeOptions(team)
      .filter((option) => option.available)
      .map((option) => option.key)
  );

  state.selectedTechs[team] = state.selectedTechs[team].filter((key) => available.has(key));
}

function getAvailableTechKeys(team) {
  return resolveTechTreeOptions(team)
    .filter((option) => option.available)
    .map((option) => option.key);
}

function updateTechSummary(team) {
  const el = teamElements(team);
  const selectedCount = state.selectedTechs[team].length;
  el.techSummary.textContent = selectedCount > 0
    ? `${selectedCount} tech selezionate`
    : 'Nessuna tech selezionata';
}

function renderTeamTechDialog(team) {
  const el = teamElements(team);
  const options = resolveTechTreeOptions(team);
  const selected = new Set(state.selectedTechs[team]);

  el.techOptions.innerHTML = '';

  for (const option of options) {
    const row = document.createElement('div');
    row.className = `tech-option${option.available ? '' : ' is-disabled'}`;

    const label = document.createElement('label');
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.value = option.key;
    input.checked = selected.has(option.key);
    input.disabled = !option.available;

    const textWrap = document.createElement('div');
    const title = document.createElement('div');
    title.className = 'tech-option-title';
    title.textContent = `${option.label}`;

    const meta = document.createElement('div');
    meta.className = 'tech-option-meta';
    meta.textContent = `${option.group} | Eta ${option.minAge}${option.reason ? ` | ${option.reason}` : ''}`;

    const description = document.createElement('div');
    description.className = 'tech-option-meta';
    description.textContent = option.shortDescription || 'Effetto applicato in simulazione';

    textWrap.appendChild(title);
    textWrap.appendChild(meta);
    textWrap.appendChild(description);

    label.appendChild(input);
    label.appendChild(textWrap);
    row.appendChild(label);
    el.techOptions.appendChild(row);
  }
}

async function loadTechsForTeam(team, { resetSelection = false } = {}) {
  const el = teamElements(team);
  const payload = await getJson(
    `/api/data/technologies?civ=${encodeURIComponent(el.civ.value)}&age=${encodeURIComponent(el.age.value)}`
  );
  const data = Array.isArray(payload.data) ? payload.data : [];
  state.techIdsByTeam[team] = new Set(data.map((item) => item.id));
  state.techCatalogByTeam[team] = new Map(data.map((item) => [item.id, item]));

  if (resetSelection) {
    state.selectedTechs[team] = getAvailableTechKeys(team);
  } else if (!state.selectedTechs[team] || state.selectedTechs[team].length === 0) {
    state.selectedTechs[team] = getAvailableTechKeys(team);
  }

  sanitizeTeamTechSelections(team);

  if (state.selectedTechs[team].length === 0) {
    state.selectedTechs[team] = getAvailableTechKeys(team);
  }

  renderTeamTechDialog(team);
  updateTechSummary(team);
}

function unitClassTokens(def) {
  return [
    ...(Array.isArray(def.classes) ? def.classes : []),
    ...(Array.isArray(def.displayClasses) ? def.displayClasses : []),
  ].map((entry) => String(entry).toLowerCase());
}

function unitSelectionKeyFromItem(item) {
  return item.selectionKey || `${item.unitId}::default`;
}

function effectTargetsUnit(effect, unit) {
  if (!effect || !effect.select || !unit) {
    return false;
  }

  const select = effect.select;
  const unitId = String(unit.id || '').toLowerCase();
  const idMatches = Array.isArray(select.id)
    ? select.id.some((id) => String(id).toLowerCase() === unitId)
    : false;

  let classMatches = false;
  if (Array.isArray(select.class)) {
    const unitClasses = unitClassTokens(unit);
    classMatches = select.class.some((group) =>
      Array.isArray(group)
      && group.every((value) => unitClasses.some((entry) => entry.includes(String(value).toLowerCase())))
    );
  }

  return idMatches || classMatches;
}

function techTextMentionsUnit(tech, unit) {
  const text = `${tech.name || ''} ${tech.description || ''}`.toLowerCase();
  const name = String(unit.name || '').toLowerCase();
  const id = String(unit.id || '').toLowerCase();
  const normalizedId = id.replace(/-/g, ' ');

  if ((name && text.includes(name)) || (normalizedId && text.includes(normalizedId))) {
    return true;
  }

  const idTokens = normalizedId.split(/\s+/).filter((token) => token.length >= 4);
  if (idTokens.length && idTokens.every((token) => text.includes(token))) {
    return true;
  }

  const aliases = {
    'man-at-arms': ['maa', 'man at arms'],
    'crossbowman': ['crossbow', 'arbaletrier'],
    'hardened-spearman': ['spearman'],
    'early-man-at-arms': ['man at arms'],
  };
  const unitAliases = aliases[id] || [];
  return unitAliases.some((alias) => text.includes(alias));
}

function isCombatRelevantUnitEffect(effect) {
  const property = String(effect && effect.property ? effect.property : '').toLowerCase();
  return [
    'hitpoints',
    'movespeed',
    'movementspeed',
    'meleearmor',
    'rangedarmor',
    'meleeattack',
    'rangedattack',
    'attack',
    'attackspeed',
    'maxrange',
  ].includes(property);
}

function hasExplicitUnitSelector(effect) {
  if (!effect || !effect.select) {
    return false;
  }
  const select = effect.select;
  return (Array.isArray(select.id) && select.id.length > 0)
    || (Array.isArray(select.class) && select.class.length > 0);
}

function resolveUnitTechOptionsForUnit(team, unitDef) {
  const age = getTeamAge(team);
  const catalog = state.unitTechCatalogByTeam[team] || new Map();
  const allTechs = [...catalog.values()];

  return allTechs
    .filter((tech) => !GENERIC_TECH_IDS.has(tech.id))
    .filter((tech) => {
      const effects = Array.isArray(tech.effects) ? tech.effects : [];
      const combatEffects = effects.filter((effect) => isCombatRelevantUnitEffect(effect));
      if (!combatEffects.length) {
        return false;
      }

      const targetsBySelector = combatEffects.some((effect) => effectTargetsUnit(effect, unitDef));
      if (targetsBySelector) {
        return true;
      }

      const hasSelector = combatEffects.some((effect) => hasExplicitUnitSelector(effect));
      if (hasSelector) {
        return false;
      }

      return techTextMentionsUnit(tech, unitDef);
    })
    .map((tech) => {
      const minAge = typeof tech.age === 'number' ? tech.age : 1;
      const available = age >= minAge;
      return {
        ...tech,
        available,
        reason: available ? '' : `Richiede Eta ${minAge}`,
      };
    })
    .sort((a, b) => {
      if (a.age !== b.age) {
        return a.age - b.age;
      }
      return String(a.name || '').localeCompare(String(b.name || ''));
    });
}

function getAvailableUnitTechKeysForUnit(team, unitDef) {
  return resolveUnitTechOptionsForUnit(team, unitDef)
    .filter((option) => option.available)
    .map((option) => option.id);
}

function selectedUnitTechMap(team) {
  return state.selectedUnitTechsByUnit[team];
}

function getSelectedUnitTechIdsForItem(team, item, options, { autoInit = true } = {}) {
  const map = selectedUnitTechMap(team);
  const key = unitSelectionKeyFromItem(item);
  const allIds = new Set(options.map((option) => option.id));
  const defaultIds = options.filter((option) => option.available).map((option) => option.id);

  if (!map.has(key)) {
    if (autoInit) {
      map.set(key, [...defaultIds]);
    }
    return autoInit ? [...defaultIds] : [];
  }

  const current = map.get(key);
  const sanitized = current.filter((id) => allIds.has(id));
  map.set(key, sanitized);
  return sanitized;
}

function setSelectedUnitTechIdsForItem(team, item, ids) {
  const map = selectedUnitTechMap(team);
  const key = unitSelectionKeyFromItem(item);
  map.set(key, [...ids]);
}

function removeSelectedUnitTechsForItem(team, item) {
  const map = selectedUnitTechMap(team);
  map.delete(unitSelectionKeyFromItem(item));
}

function renderActiveUnitTechDialog() {
  const context = state.activeUnitTechDialog;
  if (!context) {
    return;
  }

  const titleEl = byId('unit-tech-item-title');
  const optionsWrap = byId('unit-tech-item-options');
  const chargeWrap = byId('unit-tech-item-charge-wrap');
  const chargeInput = byId('unit-tech-item-charge-active');
  if (!titleEl || !optionsWrap) {
    return;
  }

  titleEl.textContent = `${context.team} - ${context.unitName} Unit Tech`;
  if (chargeWrap && chargeInput) {
    chargeWrap.hidden = !context.supportsChargeToggle;
    chargeInput.checked = context.chargeEnabled;
  }
  optionsWrap.innerHTML = '';

  for (const option of context.options) {
    const row = document.createElement('div');
    row.className = `tech-option${option.available ? '' : ' is-disabled'}`;

    const label = document.createElement('label');
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.value = option.id;
    input.checked = context.selectedIds.includes(option.id);
    input.disabled = !option.available;

    const textWrap = document.createElement('div');
    const title = document.createElement('div');
    title.className = 'tech-option-title';
    title.textContent = option.name || option.id;

    const meta = document.createElement('div');
    meta.className = 'tech-option-meta';
    meta.textContent = `Eta ${option.age || 1}${option.reason ? ` | ${option.reason}` : ''}`;

    const description = document.createElement('div');
    description.className = 'tech-option-meta';
    description.textContent = option.description || 'Effetto tech specifico unita';

    textWrap.appendChild(title);
    textWrap.appendChild(meta);
    textWrap.appendChild(description);

    label.appendChild(input);
    label.appendChild(textWrap);
    row.appendChild(label);
    optionsWrap.appendChild(row);
  }
}

function openUnitTechDialogForItem(team, item, unitDef) {
  const dialog = byId('unit-tech-item-dialog');
  if (!dialog) {
    return;
  }
  const options = resolveUnitTechOptionsForUnit(team, unitDef);
  const supportsChargeToggle = unitCanConfigureCharge(unitDef);
  if (!options.length && !supportsChargeToggle) {
    return;
  }

  const selectedIds = getSelectedUnitTechIdsForItem(team, item, options, { autoInit: true });
  state.activeUnitTechDialog = {
    team,
    item,
    options,
    selectedIds,
    unitName: item.name,
    supportsChargeToggle,
    chargeEnabled: item.chargeEnabled !== false,
  };

  renderActiveUnitTechDialog();
  if (typeof dialog.showModal === 'function') {
    dialog.showModal();
  }
}

async function loadUnitTechsForTeam(team, { resetSelection = false } = {}) {
  const el = teamElements(team);
  const payload = await getJson(
    `/api/data/technologies?civ=${encodeURIComponent(el.civ.value)}&age=4`
  );
  const data = Array.isArray(payload.data) ? payload.data : [];
  state.unitTechCatalogByTeam[team] = new Map(data.map((item) => [item.id, item]));

  if (resetSelection) {
    selectedUnitTechMap(team).clear();
  }
}

function bindUnitTechDialogHandlers() {
  const dialog = byId('unit-tech-item-dialog');
  const clearBtn = byId('unit-tech-item-clear');
  const selectAllBtn = byId('unit-tech-item-select-all');
  const applyBtn = byId('unit-tech-item-apply');
  const optionsWrap = byId('unit-tech-item-options');
  const chargeInput = byId('unit-tech-item-charge-active');

  if (!dialog || !clearBtn || !selectAllBtn || !applyBtn || !optionsWrap) {
    return;
  }

  clearBtn.addEventListener('click', () => {
    if (!state.activeUnitTechDialog) {
      return;
    }
    for (const input of optionsWrap.querySelectorAll('input[type="checkbox"]')) {
      input.checked = false;
    }
    state.activeUnitTechDialog.selectedIds = [];
  });

  selectAllBtn.addEventListener('click', () => {
    if (!state.activeUnitTechDialog) {
      return;
    }
    const selected = [];
    for (const input of optionsWrap.querySelectorAll('input[type="checkbox"]')) {
      if (!input.disabled) {
        input.checked = true;
        selected.push(input.value);
      }
    }
    state.activeUnitTechDialog.selectedIds = selected;
  });

  applyBtn.addEventListener('click', () => {
    if (!state.activeUnitTechDialog) {
      return;
    }

    const selected = [...optionsWrap.querySelectorAll('input[type="checkbox"]:checked')]
      .map((input) => input.value);
    const { team, item } = state.activeUnitTechDialog;
    setSelectedUnitTechIdsForItem(team, item, selected);
    if (chargeInput && state.activeUnitTechDialog.supportsChargeToggle) {
      item.chargeEnabled = Boolean(chargeInput.checked);
    }
    dialog.close();
    state.activeUnitTechDialog = null;
    renderUnitList(team);
  });

  dialog.addEventListener('close', () => {
    state.activeUnitTechDialog = null;
  });
}

function openUnitStratDialogForItem(team, item, unitDef) {
  const dialog = byId('unit-strat-dialog');
  if (!dialog) {
    return;
  }

  const isRanged = unitDef ? unitIsRanged(unitDef) : false;
  const current = item.strategy || {};
  const ff = current.focusFire || {};

  state.activeUnitStratDialog = { team, item, unitDef, isRanged };

  // Populate title
  const titleEl = byId('unit-strat-title');
  if (titleEl) {
    titleEl.textContent = `${item.name} – Strategia`;
  }

  // Populate strategy type options (ranged gets extra choices)
  const typeSelect = byId('unit-strat-type');
  if (typeSelect) {
    typeSelect.innerHTML = '';
    const options = [
      { value: 'straight', label: 'Straight Fight' },
      ...(isRanged ? [
        { value: 'kiting', label: 'Kiting (Focus Fire)' },
        { value: 'straightFocusFire', label: 'Straight Focus Fire' },
      ] : []),
    ];
    for (const opt of options) {
      const el = document.createElement('option');
      el.value = opt.value;
      el.textContent = opt.label;
      typeSelect.appendChild(el);
    }
    // If current type is ranged-only but unit is now melee, fall back
    const validType = isRanged ? (current.type || 'straight') : 'straight';
    typeSelect.value = validType;
  }

  // Populate focus fire target options
  const focusTarget = byId('unit-strat-focus-target');
  if (focusTarget) {
    focusTarget.innerHTML = '';
    const emptyOpt = document.createElement('option');
    emptyOpt.value = '';
    emptyOpt.textContent = 'Auto (prima che trova)';
    focusTarget.appendChild(emptyOpt);
    const enemyTeam = team === 'A' ? 'B' : 'A';
    const seen = new Map();
    for (const u of (state.selectedUnits[enemyTeam] || [])) {
      if (!seen.has(u.unitId)) {
        seen.set(u.unitId, u.name);
        const opt = document.createElement('option');
        opt.value = u.unitId;
        opt.textContent = u.name;
        focusTarget.appendChild(opt);
      }
    }
    focusTarget.value = ff.targetUnitId || '';
  }

  // Populate group split
  const groupSplit = byId('unit-strat-group-split');
  if (groupSplit) {
    groupSplit.value = String(Math.max(1, parseInt(ff.groupSplit || 1, 10)));
  }

  // Populate reattack time
  const reattackTimeEl = byId('unit-strat-reattack-time');
  if (reattackTimeEl) {
    const parsed = parseFloat(ff.reattackTime);
    const safeValue = Number.isFinite(parsed) ? Math.max(0.5, parsed) : 0.5;
    reattackTimeEl.value = String(safeValue);
  }

  // Show/hide focus settings based on current strategy type
  const currentType = typeSelect ? typeSelect.value : 'straight';
  const focusSettings = byId('unit-strat-focus-settings');
  if (focusSettings) {
    focusSettings.hidden = currentType === 'straight';
  }

  if (typeof dialog.showModal === 'function') {
    dialog.showModal();
  }
}

function bindUnitStratDialogHandlers() {
  const dialog = byId('unit-strat-dialog');
  if (!dialog) {
    return;
  }

  const typeSelect = byId('unit-strat-type');
  const focusSettings = byId('unit-strat-focus-settings');
  const cancelBtn = byId('unit-strat-cancel');
  const applyBtn = byId('unit-strat-apply');

  // Show/hide focus fire settings when strategy type changes
  if (typeSelect) {
    typeSelect.addEventListener('change', () => {
      if (focusSettings) {
        focusSettings.hidden = typeSelect.value === 'straight';
      }
    });
  }

  if (applyBtn) {
    applyBtn.addEventListener('click', () => {
      if (!state.activeUnitStratDialog) {
        return;
      }
      const ctx = state.activeUnitStratDialog;
      const typeEl = byId('unit-strat-type');
      const focusTargetEl = byId('unit-strat-focus-target');
      const groupSplitEl = byId('unit-strat-group-split');
      const reattackTimeEl = byId('unit-strat-reattack-time');

      const stratType = typeEl ? typeEl.value : 'straight';
      const hasFocusFire = stratType !== 'straight';

      ctx.item.strategy = {
        type: stratType,
        ...(hasFocusFire ? {
          focusFire: {
            targetUnitId: (focusTargetEl && focusTargetEl.value) || null,
            groupSplit: Math.max(1, Math.min(5, parseInt((groupSplitEl && groupSplitEl.value) || '1', 10))),
            reattackTime: Math.max(0.5, parseFloat((reattackTimeEl && reattackTimeEl.value) || '0.5')),
          },
        } : {}),
      };

      const { team } = ctx;
      dialog.close();
      state.activeUnitStratDialog = null;
      renderUnitList(team);
    });
  }

  if (cancelBtn) {
    cancelBtn.addEventListener('click', () => {
      dialog.close('cancel');
    });
  }

  dialog.addEventListener('close', () => {
    state.activeUnitStratDialog = null;
  });
}

function fillSelect(select, options, valueKey, labelKey) {
  select.innerHTML = '';
  for (const option of options) {
    const el = document.createElement('option');
    el.value = option[valueKey];
    el.textContent = option[labelKey];
    select.appendChild(el);
  }
}

function hashColor(input) {
  let hash = 0;
  for (let i = 0; i < input.length; i += 1) {
    hash = input.charCodeAt(i) + ((hash << 5) - hash);
  }
  const hue = Math.abs(hash) % 360;
  return `hsl(${hue} 56% 35%)`;
}

function civIconDataUri(civ) {
  const name = civ && civ.name ? civ.name : 'CIV';
  const abbr = civ && civ.abbr ? civ.abbr.toUpperCase() : '??';
  const bg1 = hashColor(`${abbr}-1`);
  const bg2 = hashColor(`${abbr}-2`);

  const svg = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 40'>
    <defs>
      <linearGradient id='g' x1='0' y1='0' x2='1' y2='1'>
        <stop offset='0%' stop-color='${bg1}'/>
        <stop offset='100%' stop-color='${bg2}'/>
      </linearGradient>
    </defs>
    <rect x='0' y='0' width='64' height='40' rx='4' fill='url(#g)'/>
    <rect x='1' y='1' width='62' height='38' rx='3' fill='none' stroke='#d7bc72' stroke-width='1.4'/>
    <text x='32' y='24' text-anchor='middle' font-size='12' font-weight='700' fill='#f8f0dc' font-family='Georgia'>${abbr}</text>
    <title>${name}</title>
  </svg>`;

  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

function normalizeAssetKey(value) {
  return String(value || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

function extractManifestAssetKey(assetPath) {
  const match = String(assetPath || '').match(/^assets\/(.+)-[a-f0-9]{6,}\.png$/i);
  if (!match) {
    return null;
  }
  return normalizeAssetKey(match[1]);
}

async function loadCivBannerMap(civs) {
  try {
    const payload = await getJson(CIV_BANNER_MANIFEST_URL);
    const routerEntryKey = Object.keys(payload || {}).find((key) => key.startsWith('_Router-'));
    if (!routerEntryKey || !Array.isArray(payload[routerEntryKey].assets)) {
      return;
    }

    const assets = payload[routerEntryKey].assets
      .filter((assetPath) => /\.png$/i.test(assetPath));

    const byKey = new Map();
    for (const assetPath of assets) {
      const key = extractManifestAssetKey(assetPath);
      if (!key || byKey.has(key)) {
        continue;
      }
      byKey.set(key, new URL(assetPath, 'https://static.aoe4world.com/vite/').toString());
    }

    for (const civ of civs) {
      const candidates = [
        civ.abbr,
        CIV_BANNER_ALIASES[civ.abbr],
        civ.slug,
      ]
        .filter(Boolean)
        .map(normalizeAssetKey);

      const url = candidates.map((key) => byKey.get(key)).find(Boolean);
      if (url) {
        civ.bannerUrl = url;
      }
    }
  } catch (_error) {
    // Keep generated fallback icons when remote manifest is unavailable.
  }
}

function updateCivIcon(team) {
  const el = teamElements(team);
  const civ = state.civByAbbr[el.civ.value];
  el.civIcon.src = (civ && civ.bannerUrl) || civIconDataUri(civ || { abbr: el.civ.value, name: el.civ.value });
}

function resolveCivAbbr(civHint) {
  if (!civHint) {
    return null;
  }
  if (state.civByAbbr[civHint]) {
    return civHint;
  }

  const normalized = String(civHint).toLowerCase();
  const found = Object.values(state.civByAbbr).find((civ) => civ.name.toLowerCase() === normalized)
    || Object.values(state.civByAbbr).find((civ) => civ.name.toLowerCase().includes(normalized));
  return found ? found.abbr : null;
}

function unitIsRanged(def) {
  return Array.isArray(def.weapons)
    && def.weapons.some((weapon) => weapon.type === 'ranged' && weapon.range && weapon.range.max > 1);
}

function unitCanConfigureCharge(def) {
  const id = String(def && def.id ? def.id : '').toLowerCase();
  const excluded = id === 'sofa' || id === 'camel-raider' || id === 'camel-rider' || (id.includes('camel') && id.includes('raider'));
  if (excluded) {
    return false;
  }
  return id.includes('knight') || id.includes('horseman');
}

function unitIconDataUri(unit) {
  const name = unit && unit.name ? unit.name : 'Unit';
  const seed = String((unit && unit.id) || name).slice(0, 3).toUpperCase();
  const bg1 = hashColor(`${seed}-u1`);
  const bg2 = hashColor(`${seed}-u2`);
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 42 42'>
    <defs>
      <linearGradient id='g' x1='0' y1='0' x2='1' y2='1'>
        <stop offset='0%' stop-color='${bg1}'/>
        <stop offset='100%' stop-color='${bg2}'/>
      </linearGradient>
    </defs>
    <rect x='0' y='0' width='42' height='42' rx='6' fill='url(#g)'/>
    <text x='21' y='25' text-anchor='middle' font-size='12' font-weight='700' fill='#f9f1dd' font-family='Georgia'>${seed}</text>
    <title>${name}</title>
  </svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

function resolveUnitIconUrl(unit) {
  if (unit && unit.iconKey) {
    return `/data/images/units/${unit.iconKey}`;
  }
  return unitIconDataUri(unit || {});
}

function updateUnitSelectIcon(team) {
  const el = teamElements(team);
  const chosenId = el.unitSelect.value;
  const def = state.unitsByTeam[team].find((unit) => unit.id === chosenId) || state.unitsByTeam[team][0];
  if (!el.unitIcon) {
    return;
  }

  if (!def) {
    el.unitIcon.src = unitIconDataUri({ id: 'na', name: 'No unit' });
    return;
  }

  el.unitIcon.src = resolveUnitIconUrl(def);
}

function isDesertRaiderDef(def) {
  return Boolean(def) && String(def.id || '').toLowerCase() === 'desert-raider';
}

function getSelectedAttackMode(team, unitId) {
  if (String(unitId || '').toLowerCase() !== 'desert-raider') {
    return null;
  }
  const el = teamElements(team);
  return el.unitAttackMode.value === 'melee' ? 'melee' : 'ranged';
}

function refreshUnitAttackModeControl(team) {
  const el = teamElements(team);
  const chosenId = el.unitSelect.value;
  const def = state.unitsByTeam[team].find((unit) => unit.id === chosenId);

  const show = isDesertRaiderDef(def);
  el.unitAttackModeWrap.classList.toggle('is-visible', show);
  if (!show) {
    el.unitAttackMode.value = 'ranged';
  }
}

function teamHasRangedCapability(team) {
  return state.unitsByTeam[team].some((unit) => unitIsRanged(unit));
}

function findPreferredUnit(units, preferredIds) {
  for (const id of preferredIds || []) {
    const found = units.find((u) => u.id === id);
    if (found) {
      return found;
    }
  }
  return null;
}

function findUnitByKeywords(units, keywords) {
  if (!Array.isArray(keywords) || !keywords.length) {
    return null;
  }

  const normalized = keywords.map((kw) => String(kw).toLowerCase());
  return units.find((unit) => {
    const name = String(unit.name || '').toLowerCase();
    return normalized.every((kw) => name.includes(kw));
  }) || null;
}

function resolveUnitFromSpec(units, spec) {
  return (
    findPreferredUnit(units, spec.preferredIds || [])
    || findUnitByKeywords(units, spec.keywords || [])
    || units[0]
    || null
  );
}

function getUnitResourceTotal(def) {
  if (!def || !def.costs) {
    return 0;
  }

  if (typeof def.costs.total === 'number') {
    return def.costs.total;
  }

  const food = Number(def.costs.food || 0);
  const wood = Number(def.costs.wood || 0);
  const gold = Number(def.costs.gold || 0);
  const stone = Number(def.costs.stone || 0);
  return food + wood + gold + stone;
}

function formatResourceNumber(value) {
  return new Intl.NumberFormat('it-IT').format(Math.max(0, Math.round(Number(value) || 0)));
}

function computeTeamResourceBreakdown(team, defsById) {
  const totals = {
    food: 0,
    gold: 0,
    wood: 0,
  };

  for (const item of state.selectedUnits[team]) {
    const unitDef = defsById.get(item.unitId);
    if (!unitDef || !unitDef.costs) {
      continue;
    }
    const count = Math.max(0, Number(item.count) || 0);
    totals.food += count * (Number(unitDef.costs.food || 0) || 0);
    totals.gold += count * (Number(unitDef.costs.gold || 0) || 0);
    totals.wood += count * (Number(unitDef.costs.wood || 0) || 0);
  }

  totals.total = totals.food + totals.gold + totals.wood;
  return totals;
}

function renderTeamResourceSummary(team, defsById) {
  const { resourceSummary } = teamElements(team);
  if (!resourceSummary) {
    return;
  }

  const totals = computeTeamResourceBreakdown(team, defsById);
  const totalEl = resourceSummary.querySelector('.unit-resource-summary-total');
  const breakdownEl = resourceSummary.querySelector('.unit-resource-summary-breakdown');

  if (totalEl) {
    totalEl.textContent = `Totale: ${formatResourceNumber(totals.total)}`;
  }
  if (breakdownEl) {
    breakdownEl.textContent = `Cibo ${formatResourceNumber(totals.food)} • Oro ${formatResourceNumber(totals.gold)} • Legna ${formatResourceNumber(totals.wood)}`;
  }
}

function renderUnitList(team) {
  const { unitList } = teamElements(team);
  const items = state.selectedUnits[team];
  const defsById = new Map(state.unitsByTeam[team].map((u) => [u.id, u]));

  renderTeamResourceSummary(team, defsById);

  unitList.innerHTML = '';
  for (const item of items) {
    const li = document.createElement('li');
    li.className = 'unit-batch';

    const icon = document.createElement('img');
    icon.className = 'unit-batch-icon';
    icon.alt = `${item.name} icon`;
    icon.src = resolveUnitIconUrl(defsById.get(item.unitId) || item);

    const meta = document.createElement('div');
    meta.className = 'unit-batch-meta';

    const title = document.createElement('div');
    title.className = 'unit-batch-name';
    const modeText = item.attackMode ? ` (${item.attackMode})` : '';
    title.textContent = `${item.name}${modeText}`;

    const count = document.createElement('div');
    count.className = 'unit-batch-count';
    const unitDef = defsById.get(item.unitId);
    const unitResourceTotal = getUnitResourceTotal(unitDef);
    const batchResourceTotal = item.count * unitResourceTotal;
    const techOptions = unitDef ? resolveUnitTechOptionsForUnit(team, unitDef) : [];
    const supportsChargeToggle = unitDef ? unitCanConfigureCharge(unitDef) : false;
    const selectedTechIds = techOptions.length
      ? getSelectedUnitTechIdsForItem(team, item, techOptions, { autoInit: true })
      : [];
    const techSuffix = techOptions.length ? ` • tech ${selectedTechIds.length}/${techOptions.length}` : '';
    const chargeSuffix = supportsChargeToggle && item.chargeEnabled === false ? ' • charge off' : '';
    const stratType = item.strategy && item.strategy.type ? item.strategy.type : 'straight';
    const stratLabel = stratType === 'kiting' ? 'kiting' : stratType === 'straightFocusFire' ? 'focus fire' : '';
    const stratSuffix = stratLabel ? ` • ${stratLabel}` : '';
    count.textContent = `x${item.count} • ${batchResourceTotal} res${techSuffix}${chargeSuffix}${stratSuffix}`;
    meta.appendChild(title);
    meta.appendChild(count);

    const actions = document.createElement('div');
    actions.className = 'unit-batch-actions';

    const stratBtn = document.createElement('button');
    stratBtn.type = 'button';
    stratBtn.className = 'btn unit-batch-strat-btn';
    stratBtn.textContent = '⚔';
    stratBtn.title = 'Strategia unita';
    stratBtn.addEventListener('click', () => {
      openUnitStratDialogForItem(team, item, unitDef);
    });
    actions.appendChild(stratBtn);

    if ((techOptions.length || supportsChargeToggle) && unitDef) {
      const techBtn = document.createElement('button');
      techBtn.type = 'button';
      techBtn.className = 'btn unit-batch-tech-btn';
      techBtn.textContent = '⚙';
      techBtn.title = 'Unit tech e impostazioni unita';
      techBtn.addEventListener('click', () => {
        openUnitTechDialogForItem(team, item, unitDef);
      });
      actions.appendChild(techBtn);
    }

    const removeBtn = document.createElement('button');
    removeBtn.type = 'button';
    removeBtn.textContent = '✕';
    removeBtn.className = 'btn unit-batch-remove-btn';
    removeBtn.title = 'Rimuovi unita';
    removeBtn.addEventListener('click', () => {
      const removeKey = item.selectionKey || `${item.unitId}::default`;
      removeSelectedUnitTechsForItem(team, item);
      state.selectedUnits[team] = state.selectedUnits[team].filter((u) => {
        const key = u.selectionKey || `${u.unitId}::default`;
        return key !== removeKey;
      });
      renderUnitList(team);
    });
    actions.appendChild(removeBtn);

    li.appendChild(icon);
    li.appendChild(meta);
    li.appendChild(actions);
    unitList.appendChild(li);
  }
}

function refreshAllFocusTargetOptions() {
  // Focus fire targets are now per-unit, populated when the strat dialog opens.
}



async function loadUnitsForTeam(team, { resetSelected = false, resetTechSelection = false } = {}) {
  const el = teamElements(team);
  const civ = el.civ.value;
  const age = el.age.value;

  const payload = await getJson(`/api/data/units?civ=${encodeURIComponent(civ)}&age=${encodeURIComponent(age)}`);
  state.unitsByTeam[team] = (payload.data || []).filter((unit) => !isBannedUnit(unit));
  await Promise.all([
    loadTechsForTeam(team, { resetSelection: resetTechSelection }),
    loadUnitTechsForTeam(team, { resetSelection: resetTechSelection }),
  ]);

  fillSelect(el.unitSelect, state.unitsByTeam[team], 'id', 'name');
  updateUnitSelectIcon(team);

  const allowed = new Set(state.unitsByTeam[team].map((u) => u.id));
  if (resetSelected) {
    state.selectedUnits[team] = [];
    selectedUnitTechMap(team).clear();
  } else {
    state.selectedUnits[team] = state.selectedUnits[team].filter((item) => allowed.has(item.unitId));
    const aliveKeys = new Set(state.selectedUnits[team].map((item) => unitSelectionKeyFromItem(item)));
    for (const key of [...selectedUnitTechMap(team).keys()]) {
      if (!aliveKeys.has(key)) {
        selectedUnitTechMap(team).delete(key);
      }
    }
  }

  renderUnitList(team);
  refreshUnitAttackModeControl(team);
  updateCivIcon(team);
  refreshAllFocusTargetOptions();
}

async function applyTeamTemplate(team, templateTeam) {
  const el = teamElements(team);

  const civAbbr = resolveCivAbbr(templateTeam.civHint) || el.civ.value;
  el.civ.value = civAbbr;
  el.age.value = String(templateTeam.age || 2);
  el.formation.value = templateTeam.formation || 'normal';
  state.selectedTechs[team] = [];
  selectedUnitTechMap(team).clear();

  await loadUnitsForTeam(team, { resetSelected: true });

  const units = state.unitsByTeam[team];
  state.selectedUnits[team] = [];

  const defaultStratType = templateTeam.strategy || 'straight';

  for (const spec of templateTeam.units || []) {
    const found = resolveUnitFromSpec(units, spec);
    if (!found) {
      continue;
    }
    state.selectedUnits[team].push({
      unitId: found.id,
      name: found.name,
      count: spec.count || 1,
      chargeEnabled: true,
      strategy: { type: defaultStratType },
    });
  }

  renderUnitList(team);
  refreshAllFocusTargetOptions();
  updateTechSummary(team);
}

async function applyTemplate(templateId) {
  const template = templates.find((item) => item.id === templateId);
  if (!template) {
    return;
  }

  byId('environment').value = template.environment || 'dry-arabia';
  await applyTeamTemplate('A', template.teamA);
  await applyTeamTemplate('B', template.teamB);
}

function attachTeamHandlers(team) {
  const el = teamElements(team);

  el.civ.addEventListener('change', async () => {
    await loadUnitsForTeam(team, { resetSelected: true, resetTechSelection: true });
  });

  el.age.addEventListener('change', async () => {
    await loadUnitsForTeam(team, { resetSelected: true, resetTechSelection: true });
  });

  el.techButton.addEventListener('click', () => {
    renderTeamTechDialog(team);
    if (typeof el.techDialog.showModal === 'function') {
      el.techDialog.showModal();
    }
  });

  el.techApply.addEventListener('click', () => {
    const selected = [...el.techOptions.querySelectorAll('input[type="checkbox"]:checked')]
      .map((input) => input.value);
    state.selectedTechs[team] = selected;
    updateTechSummary(team);
    el.techDialog.close();
  });

  el.techClear.addEventListener('click', () => {
    for (const input of el.techOptions.querySelectorAll('input[type="checkbox"]')) {
      input.checked = false;
    }
    state.selectedTechs[team] = [];
    updateTechSummary(team);
  });

  el.techSelectAll.addEventListener('click', () => {
    for (const input of el.techOptions.querySelectorAll('input[type="checkbox"]')) {
      if (!input.disabled) {
        input.checked = true;
      }
    }
    state.selectedTechs[team] = getAvailableTechKeys(team);
    updateTechSummary(team);
  });

  el.unitSelect.addEventListener('change', () => {
    refreshUnitAttackModeControl(team);
    updateUnitSelectIcon(team);
  });

  const addButton = document.querySelector(`.add-unit[data-team="${team}"]`);
  addButton.addEventListener('click', () => {
    const chosenId = el.unitSelect.value;
    const count = Math.max(1, parseInt(el.unitCount.value || '1', 10));

    const def = state.unitsByTeam[team].find((u) => u.id === chosenId);
    if (!def) {
      return;
    }

    const attackMode = getSelectedAttackMode(team, chosenId);
    const selectionKey = `${chosenId}::${attackMode || 'default'}`;

    const existing = state.selectedUnits[team].find((u) => {
      const key = u.selectionKey || `${u.unitId}::default`;
      return key === selectionKey;
    });
    if (existing) {
      existing.count = count;
      existing.attackMode = attackMode;
    } else {
      const created = {
        unitId: chosenId,
        count,
        name: def.name,
        attackMode,
        selectionKey,
        chargeEnabled: true,
        strategy: { type: 'straight' },
      };
      state.selectedUnits[team].push(created);

      const techOptions = resolveUnitTechOptionsForUnit(team, def);
      const defaults = techOptions.filter((option) => option.available).map((option) => option.id);
      setSelectedUnitTechIdsForItem(team, created, defaults);
    }

    renderUnitList(team);
    refreshAllFocusTargetOptions();
  });
}

function readTeamConfig(team) {
  const el = teamElements(team);

  return {
    civ: el.civ.value,
    age: parseInt(el.age.value, 10),
    formation: el.formation.value,
    techs: [...state.selectedTechs[team]],
    units: state.selectedUnits[team].map((u) => {
      const def = state.unitsByTeam[team].find((unit) => unit.id === u.unitId);
      return {
        unitId: u.unitId,
        count: u.count,
        attackMode: u.attackMode || null,
        chargeEnabled: u.chargeEnabled !== false,
        strategy: u.strategy || { type: 'straight' },
        unitTechs: getSelectedUnitTechIdsForItem(
          team,
          u,
          resolveUnitTechOptionsForUnit(team, def || u),
          { autoInit: true }
        ),
      };
    }),
  };
}

function applyDefaultPreset() {
  const teamAUnits = state.unitsByTeam.A;
  const teamBUnits = state.unitsByTeam.B;

  if (!teamAUnits.length || !teamBUnits.length) {
    return;
  }

  const presetA1 = findPreferredUnit(teamAUnits, ['longbowman']) || teamAUnits[0];
  const presetA2 = findPreferredUnit(teamAUnits, ['hardened-spearman', 'spearman']) || teamAUnits[0];
  const presetB1 = findPreferredUnit(teamBUnits, ['royal-knight', 'knight']) || teamBUnits[0];
  const presetB2 = findPreferredUnit(teamBUnits, ['archer']) || teamBUnits[0];

  state.selectedUnits.A = [
    presetA1 ? { unitId: presetA1.id, count: 40, name: presetA1.name } : null,
    presetA2 ? { unitId: presetA2.id, count: 40, name: presetA2.name } : null,
  ].filter(Boolean);

  state.selectedUnits.B = [
    presetB1 ? { unitId: presetB1.id, count: 16, name: presetB1.name } : null,
    presetB2 ? { unitId: presetB2.id, count: 40, name: presetB2.name } : null,
  ].filter(Boolean);

  renderUnitList('A');
  renderUnitList('B');
  refreshAllFocusTargetOptions();
  updateTechSummary('A');
  updateTechSummary('B');
}

function initTemplateSelector() {
  const select = byId('template-select');
  select.innerHTML = '';

  const placeholder = document.createElement('option');
  placeholder.value = '';
  placeholder.textContent = 'Seleziona template';
  placeholder.disabled = true;
  placeholder.selected = true;
  select.appendChild(placeholder);

  for (const item of templates) {
    const option = document.createElement('option');
    option.value = item.id;
    option.textContent = item.label;
    select.appendChild(option);
  }
}

export async function initUi() {
  const civPayload = await getJson('/api/data/civilizations');
  const civs = civPayload.data || [];
  await loadCivBannerMap(civs);
  state.civByAbbr = Object.fromEntries(civs.map((civ) => [civ.abbr, civ]));

  const a = teamElements('A');
  const b = teamElements('B');

  fillSelect(a.civ, civs, 'abbr', 'name');
  fillSelect(b.civ, civs, 'abbr', 'name');

  a.civ.value = 'en';
  b.civ.value = 'fr';

  bindUnitTechDialogHandlers();
  bindUnitStratDialogHandlers();
  attachTeamHandlers('A');
  attachTeamHandlers('B');

  await Promise.all([
    loadUnitsForTeam('A'),
    loadUnitsForTeam('B'),
  ]);

  initTemplateSelector();
  applyDefaultPreset();

  byId('template-select').addEventListener('change', async (event) => {
    const selectedTemplate = event.target.value;
    if (selectedTemplate) {
      await applyTemplate(selectedTemplate);
    }
  });

  return {
    readConfig: () => ({
      teamA: readTeamConfig('A'),
      teamB: readTeamConfig('B'),
      environment: byId('environment').value,
      environmentSeed: (byId('environment-seed') && byId('environment-seed').value) || 'default',
    }),
    setStatus: (text) => {
      byId('status').textContent = text;
    },
    setPlaybackInfo: (text) => {
      byId('playback-info').textContent = text;
    },
    setResult: (obj) => {
      byId('result').textContent = typeof obj === 'string' ? obj : JSON.stringify(obj, null, 2);
    },
    getStartButton: () => byId('start-btn'),
    getPlaybackToggleButton: () => byId('playback-toggle'),
    getReplayResetButton: () => byId('replay-reset'),
    getSpeedButtons: () => [...document.querySelectorAll('.speed-btn')],
    getZoomSlider: () => byId('zoom-slider'),
    getZoomInButton: () => byId('zoom-in'),
    getZoomOutButton: () => byId('zoom-out'),
    getEnvironmentSelect: () => byId('environment'),
    getEnvironmentSeedInput: () => byId('environment-seed'),
    getBattlefieldCanvas: () => byId('battlefield'),
    getTeamsMeta: () => {
      const aCiv = state.civByAbbr[a.civ.value] || { abbr: a.civ.value, name: a.civ.value };
      const bCiv = state.civByAbbr[b.civ.value] || { abbr: b.civ.value, name: b.civ.value };
      return {
        A: {
          civAbbr: aCiv.abbr,
          civName: aCiv.name,
          banner: a.civIcon && a.civIcon.src ? a.civIcon.src : civIconDataUri(aCiv),
        },
        B: {
          civAbbr: bCiv.abbr,
          civName: bCiv.name,
          banner: b.civIcon && b.civIcon.src ? b.civIcon.src : civIconDataUri(bCiv),
        },
      };
    },
  };
}
