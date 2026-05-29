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
  selectedUnits: {
    A: [],
    B: [],
  },
  selectedTechs: {
    A: [],
    B: [],
  },
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
    strategy: byId(`team${team}-strategy`),
    focusEnabled: byId(`team${team}-focus-enabled`),
    focusWrap: byId(`team${team}-focus-wrap`),
    focusTargetWrap: byId(`team${team}-focus-target-wrap`),
    focusSource: byId(`team${team}-focus-source`),
    focusTarget: byId(`team${team}-focus-target`),
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

function renderUnitList(team) {
  const { unitList } = teamElements(team);
  const items = state.selectedUnits[team];
  const defsById = new Map(state.unitsByTeam[team].map((u) => [u.id, u]));

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
    count.textContent = `x${item.count} • ${batchResourceTotal} res`;
    meta.appendChild(title);
    meta.appendChild(count);

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.textContent = 'remove';
    btn.className = 'btn';
    btn.style.width = 'auto';
    btn.style.marginTop = '0';
    btn.addEventListener('click', () => {
      const removeKey = item.selectionKey || `${item.unitId}::default`;
      state.selectedUnits[team] = state.selectedUnits[team].filter((u) => {
        const key = u.selectionKey || `${u.unitId}::default`;
        return key !== removeKey;
      });
      renderUnitList(team);
      refreshAllFocusTargetOptions();
    });

    li.appendChild(icon);
    li.appendChild(meta);
    li.appendChild(btn);
    unitList.appendChild(li);
  }
}

function refreshFocusTargetOptions(team) {
  const el = teamElements(team);
  const enemy = otherTeam(team);
  const enemyUnits = state.selectedUnits[enemy];
  const options = new Map();

  for (const item of enemyUnits) {
    if (!options.has(item.unitId)) {
      options.set(item.unitId, { ...item });
      continue;
    }
    const current = options.get(item.unitId);
    current.count += item.count;
  }

  const current = el.focusTarget.value;
  el.focusTarget.innerHTML = '';

  const empty = document.createElement('option');
  empty.value = '';
  empty.textContent = 'Auto target';
  el.focusTarget.appendChild(empty);

  for (const item of options.values()) {
    const option = document.createElement('option');
    option.value = item.unitId;
    option.textContent = `${item.name} (${item.count})`;
    el.focusTarget.appendChild(option);
  }

  if ([...el.focusTarget.options].some((option) => option.value === current)) {
    el.focusTarget.value = current;
  }
}

function refreshFocusSourceOptions(team) {
  const el = teamElements(team);
  const ownUnits = state.selectedUnits[team];
  const defsById = new Map(state.unitsByTeam[team].map((u) => [u.id, u]));

  const current = el.focusSource.value;
  el.focusSource.innerHTML = '';

  const empty = document.createElement('option');
  empty.value = '';
  empty.textContent = 'Tutti i ranged';
  el.focusSource.appendChild(empty);

  const options = new Map();
  for (const item of ownUnits) {
    const def = defsById.get(item.unitId);
    if (!def || !unitIsRanged(def)) {
      continue;
    }
    if (!options.has(item.unitId)) {
      options.set(item.unitId, { ...item });
      continue;
    }
    const current = options.get(item.unitId);
    current.count += item.count;
  }

  for (const item of options.values()) {
    const option = document.createElement('option');
    option.value = item.unitId;
    option.textContent = `${item.name} (${item.count})`;
    el.focusSource.appendChild(option);
  }

  if ([...el.focusSource.options].some((option) => option.value === current)) {
    el.focusSource.value = current;
  }
}

function refreshAllFocusTargetOptions() {
  refreshFocusSourceOptions('A');
  refreshFocusSourceOptions('B');
  refreshFocusTargetOptions('A');
  refreshFocusTargetOptions('B');
}

function refreshStrategyControls(team) {
  const el = teamElements(team);
  const hasRanged = teamHasRangedCapability(team);

  if (el.strategy.value === 'kiting') {
    el.strategy.value = 'straight';
  }

  if (!hasRanged) {
    el.focusEnabled.checked = false;
  }
  el.focusEnabled.disabled = !hasRanged;

  const showFocus = hasRanged && el.focusEnabled.checked;
  el.focusWrap.classList.toggle('is-visible', showFocus);
  el.focusTargetWrap.classList.toggle('is-visible', showFocus);
}

async function loadUnitsForTeam(team, { resetSelected = false, resetTechSelection = false } = {}) {
  const el = teamElements(team);
  const civ = el.civ.value;
  const age = el.age.value;

  const payload = await getJson(`/api/data/units?civ=${encodeURIComponent(civ)}&age=${encodeURIComponent(age)}`);
  state.unitsByTeam[team] = (payload.data || []).filter((unit) => !isBannedUnit(unit));
  await loadTechsForTeam(team, { resetSelection: resetTechSelection });

  fillSelect(el.unitSelect, state.unitsByTeam[team], 'id', 'name');
  updateUnitSelectIcon(team);

  const allowed = new Set(state.unitsByTeam[team].map((u) => u.id));
  if (resetSelected) {
    state.selectedUnits[team] = [];
  } else {
    state.selectedUnits[team] = state.selectedUnits[team].filter((item) => allowed.has(item.unitId));
  }

  renderUnitList(team);
  refreshUnitAttackModeControl(team);
  updateCivIcon(team);
  refreshStrategyControls(team);
  refreshAllFocusTargetOptions();
}

async function applyTeamTemplate(team, templateTeam) {
  const el = teamElements(team);

  const civAbbr = resolveCivAbbr(templateTeam.civHint) || el.civ.value;
  el.civ.value = civAbbr;
  el.age.value = String(templateTeam.age || 2);
  el.formation.value = templateTeam.formation || 'normal';
  el.strategy.value = templateTeam.strategy || 'straight';
  el.focusEnabled.checked = false;
  state.selectedTechs[team] = [];

  await loadUnitsForTeam(team, { resetSelected: true });

  const units = state.unitsByTeam[team];
  state.selectedUnits[team] = [];

  for (const spec of templateTeam.units || []) {
    const found = resolveUnitFromSpec(units, spec);
    if (!found) {
      continue;
    }
    state.selectedUnits[team].push({
      unitId: found.id,
      name: found.name,
      count: spec.count || 1,
    });
  }

  renderUnitList(team);
  refreshStrategyControls(team);
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

  el.strategy.addEventListener('change', () => {
    refreshStrategyControls(team);
  });

  el.unitSelect.addEventListener('change', () => {
    refreshUnitAttackModeControl(team);
    updateUnitSelectIcon(team);
  });

  el.focusEnabled.addEventListener('change', () => {
    refreshStrategyControls(team);
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
      state.selectedUnits[team].push({
        unitId: chosenId,
        count,
        name: def.name,
        attackMode,
        selectionKey,
      });
    }

    renderUnitList(team);
    refreshAllFocusTargetOptions();
    refreshStrategyControls(team);
  });
}

function readTeamConfig(team) {
  const el = teamElements(team);
  const strategyType = el.strategy.value === 'kiting' ? 'straight' : el.strategy.value;

  return {
    civ: el.civ.value,
    age: parseInt(el.age.value, 10),
    formation: el.formation.value,
    strategy: {
      type: strategyType,
      focusFire: {
        enabled: Boolean(el.focusEnabled.checked),
        sourceUnitId: el.focusSource.value || null,
        targetUnitId: el.focusTarget.value || null,
      },
    },
    techs: [...state.selectedTechs[team]],
    units: state.selectedUnits[team].map((u) => ({
      unitId: u.unitId,
      count: u.count,
      attackMode: u.attackMode || null,
    })),
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
  refreshStrategyControls('A');
  refreshStrategyControls('B');
  updateTechSummary('A');
  updateTechSummary('B');
}

function initTemplateSelector() {
  const select = byId('template-select');
  select.innerHTML = '';
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

  attachTeamHandlers('A');
  attachTeamHandlers('B');

  await Promise.all([
    loadUnitsForTeam('A'),
    loadUnitsForTeam('B'),
  ]);

  initTemplateSelector();
  applyDefaultPreset();

  byId('load-template-btn').addEventListener('click', async () => {
    const selectedTemplate = byId('template-select').value;
    await applyTemplate(selectedTemplate);
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
