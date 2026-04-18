/* global __BUILD_ID__ */
import {
  LEVELS_PER_PAGE,
  TOTAL_LEVELS,
  completeLevel,
  createDefaultCampaignProgress,
  getLevelsForPage,
  getPageCount,
  getPageRange,
  loadCampaignProgress,
  saveCampaignProgress,
} from './campaign-state.js';
import { createGameplaySession } from './gameplay-session.js';
import { getLevelDefinition } from './level-definition.js';

const BUILD_ID = typeof __BUILD_ID__ !== 'undefined' ? __BUILD_ID__ : 'dev';

const APP_SCREEN = {
  title: 'title',
  levelSelect: 'level-select',
  gameplay: 'gameplay',
  victory: 'victory',
  defeat: 'defeat',
};

const showFatalError = (error) => {
  const overlay = document.getElementById('fatalOverlay');
  const message = document.getElementById('fatalMessage');
  const detail = error instanceof Error ? error.message : String(error);
  if (message) message.textContent = `The 3D scene could not start.\n\n${detail}`;
  if (overlay) overlay.style.display = 'flex';
};

const refs = {
  gameCanvasHost: document.getElementById('gameCanvasHost'),
  titleScreen: document.getElementById('titleScreen'),
  levelSelectScreen: document.getElementById('levelSelectScreen'),
  victoryScreen: document.getElementById('victoryScreen'),
  defeatScreen: document.getElementById('defeatScreen'),
  startButton: document.getElementById('startButton'),
  titleTapTarget: document.getElementById('titleTapTarget'),
  titleBuildBadge: document.getElementById('titleBuildBadge'),
  levelGrid: document.getElementById('levelGrid'),
  levelPageLabel: document.getElementById('levelPageLabel'),
  levelProgressLabel: document.getElementById('levelProgressLabel'),
  previousPageButton: document.getElementById('previousPageButton'),
  nextPageButton: document.getElementById('nextPageButton'),
  backToTitleButton: document.getElementById('backToTitleButton'),
  gameplayHud: document.getElementById('gameplayHud'),
  antCountValue: document.getElementById('antCountValue'),
  selectedAntBreakdown: document.getElementById('selectedAntBreakdown'),
  nestFoodOverlay: document.getElementById('nestFoodOverlay'),
  gameplayLevelLabel: document.getElementById('gameplayLevelLabel'),
  hud: document.getElementById('hud'),
  hudHint: document.getElementById('hudHint'),
  selectedNestInfo: document.getElementById('selectedNestInfo'),
  focusInfo: document.getElementById('focusInfo'),
  objectiveInfo: document.getElementById('objectiveInfo'),
  battleInfo: document.getElementById('battleInfo'),
  foodInfo: document.getElementById('foodInfo'),
  nestUpgradeOverlay: document.getElementById('nestUpgradeOverlay'),
  nestUpgradePanel: document.getElementById('nestUpgradePanel'),
  nestUpgradeTitle: document.getElementById('nestUpgradeTitle'),
  nestUpgradeFoodInfo: document.getElementById('nestUpgradeFoodInfo'),
  upgradeCards: document.getElementById('upgradeCards'),
  upgradeDetail: document.getElementById('upgradeDetail'),
  upgradeDetailLabel: document.getElementById('upgradeDetailLabel'),
  upgradeDetailCost: document.getElementById('upgradeDetailCost'),
  upgradeDetailCopy: document.getElementById('upgradeDetailCopy'),
  upgradeDetailStatus: document.getElementById('upgradeDetailStatus'),
  upgradeConfirmButton: document.getElementById('upgradeConfirmButton'),
  upgradeFeedbackToast: document.getElementById('upgradeFeedbackToast'),
  returnToLevelSelectButton: document.getElementById('returnToLevelSelectButton'),
  cameraModeButton: document.getElementById('cameraModeButton'),
  cameraModeValue: document.getElementById('cameraModeValue'),
  debugMenu: document.getElementById('debugMenu'),
  debugCameraModeLabel: document.getElementById('debugCameraModeLabel'),
  debugCameraOrbitButton: document.getElementById('debugCameraOrbitButton'),
  debugCameraBattlefieldButton: document.getElementById('debugCameraBattlefieldButton'),
  debugVisualsButton: document.getElementById('debugVisualsButton'),
  victoryKicker: document.getElementById('victoryKicker'),
  victoryLevelLabel: document.getElementById('victoryLevelLabel'),
  victorySummary: document.getElementById('victorySummary'),
  nextLevelButton: document.getElementById('nextLevelButton'),
  victoryLevelSelectButton: document.getElementById('victoryLevelSelectButton'),
  defeatKicker: document.getElementById('defeatKicker'),
  defeatLevelLabel: document.getElementById('defeatLevelLabel'),
  defeatSummary: document.getElementById('defeatSummary'),
  retryLevelButton: document.getElementById('retryLevelButton'),
  defeatLevelSelectButton: document.getElementById('defeatLevelSelectButton'),
};

const CAMERA_MODE = {
  orbit: 'orbit',
  battlefield: 'battlefield',
};

const app = {
  screen: APP_SCREEN.title,
  currentLevel: 1,
  currentPage: 0,
  progress: loadCampaignProgress() || createDefaultCampaignProgress(),
  lastHudSummary: null,
  upgradeNestId: null,
  selectedUpgradeId: null,
  upgradeFeedback: null,
  debugVisualsEnabled: false,
  debugMenuVisible: false,
  cameraMode: CAMERA_MODE.battlefield,
};

const UPGRADE_ICON = {
  'repair-nest': '🩹',
  'spawn-workers': '🐜',
  'spawn-fighters': '⚔️',
  'brood-chambers': '🥚',
  'war-nest': '🛡️',
  'fortify-nest': '🏰',
};

const UPGRADE_TITLE = {
  'repair-nest': 'Repair nest',
  'spawn-workers': 'worker ants',
  'spawn-fighters': 'warrior ants',
  'brood-chambers': 'Brood chambers',
  'war-nest': 'War nest',
  'fortify-nest': 'Fortify nest',
};

const getCurrentLevelDefinition = () => getLevelDefinition(app.currentLevel);
const shouldAutoStartDebugLevel = () => {
  const params = new URLSearchParams(window.location.search);
  return params.get('debug') === '1';
};

const renderDebugMenu = () => {
  if (refs.cameraModeValue) refs.cameraModeValue.textContent = app.cameraMode === CAMERA_MODE.battlefield ? 'Battlefield camera' : 'Orbit camera';
  if (refs.cameraModeButton) refs.cameraModeButton.textContent = app.cameraMode === CAMERA_MODE.battlefield
    ? 'Switch to orbit camera'
    : 'Switch to battlefield camera';
  if (!refs.debugMenu) return;
  if (app.debugMenuVisible && refs.hud) refs.hud.open = true;
  refs.debugMenu.hidden = !app.debugMenuVisible;
  if (refs.debugCameraModeLabel) refs.debugCameraModeLabel.textContent = app.cameraMode === CAMERA_MODE.battlefield ? 'Battlefield camera' : 'Orbit camera';
  if (refs.debugCameraOrbitButton) refs.debugCameraOrbitButton.dataset.active = String(app.cameraMode === CAMERA_MODE.orbit);
  if (refs.debugCameraBattlefieldButton) refs.debugCameraBattlefieldButton.dataset.active = String(app.cameraMode === CAMERA_MODE.battlefield);
  if (refs.debugVisualsButton) {
    refs.debugVisualsButton.dataset.active = String(app.debugVisualsEnabled);
    refs.debugVisualsButton.textContent = app.debugVisualsEnabled ? 'Debug visuals on' : 'Debug visuals off';
  }
};

const closeUpgradePanel = () => {
  app.upgradeNestId = null;
  app.selectedUpgradeId = null;
  app.upgradeFeedback = null;
  if (refs.nestUpgradePanel) refs.nestUpgradePanel.hidden = true;
  if (refs.upgradeDetail) refs.upgradeDetail.hidden = true;
  if (refs.upgradeFeedbackToast) refs.upgradeFeedbackToast.hidden = true;
};

const getUpgradeSummaryText = (option) => {
  if (!option) return '';
  if (option.id === 'spawn-workers' || option.id === 'spawn-fighters') {
    const countMatch = option.description.match(/Spawn\s+(\d+)/i);
    const count = countMatch ? Number(countMatch[1]) : null;
    if (count != null && Number.isFinite(count)) return `${count} ${UPGRADE_TITLE[option.id]}`;
  }
  return UPGRADE_TITLE[option.id] ?? option.label;
};

const getUpgradePurchaseText = (option) => `${getUpgradeSummaryText(option)} bought`;

const renderNestFoodOverlay = (summary) => {
  if (!refs.nestFoodOverlay) return;
  refs.nestFoodOverlay.replaceChildren();
  const overlays = summary?.nestFoodOverlays ?? [];
  if (!overlays.length || app.screen !== APP_SCREEN.gameplay) return;

  for (const overlay of overlays) {
    const badge = document.createElement('div');
    badge.className = 'nestFoodBadge';
    badge.dataset.faction = overlay.faction;
    badge.dataset.selected = String(!!overlay.selected);
    badge.textContent = `${overlay.food.toFixed(0)}`;
    badge.style.left = `${overlay.x}px`;
    badge.style.top = `${overlay.y}px`;
    refs.nestFoodOverlay.appendChild(badge);
  }
};

const renderUpgradeCards = (summary) => {
  if (!refs.upgradeCards || !refs.nestUpgradePanel) return;
  refs.upgradeCards.replaceChildren();
  const options = summary?.upgradeOptions ?? [];
  const anchor = summary?.upgradeAnchor;
  if (!options.length || !anchor || app.screen !== APP_SCREEN.gameplay || app.upgradeNestId !== summary?.selectedNestId) {
    refs.nestUpgradePanel.hidden = true;
    if (refs.upgradeDetail) refs.upgradeDetail.hidden = true;
    if (refs.upgradeFeedbackToast) refs.upgradeFeedbackToast.hidden = true;
    return;
  }

  refs.nestUpgradePanel.hidden = false;
  const clampedX = Math.min(window.innerWidth - 12, Math.max(12, anchor.x));
  const clampedY = Math.min(window.innerHeight - 12, Math.max(72, anchor.y));
  refs.nestUpgradePanel.style.left = `${clampedX}px`;
  refs.nestUpgradePanel.style.top = `${clampedY}px`;

  const panelWidth = Math.min(300, Math.max(140, window.innerWidth - 24));
  const buttonFootprint = 80;
  const fitsSingleRow = options.length * buttonFootprint <= panelWidth;
  refs.upgradeCards.dataset.wrap = fitsSingleRow ? 'false' : 'true';

  for (const option of options) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'upgradeChip';
    button.disabled = !!option.disabled;
    button.dataset.upgradeId = option.id;
    button.dataset.active = app.selectedUpgradeId === option.id ? 'true' : 'false';
    button.dataset.affordable = option.disabled ? 'false' : 'true';
    button.setAttribute('aria-label', `${option.label}, ${option.cost.toFixed(0)} food${option.shortfall > 0 ? `, needs ${option.shortfall.toFixed(1)} more food` : ''}`);
    button.innerHTML = `
      <span class="upgradeChipIcon">${UPGRADE_ICON[option.id] ?? 'up'}</span>
      <span class="upgradeChipCost">${option.cost.toFixed(0)}</span>
    `;
    button.addEventListener('click', () => {
      app.selectedUpgradeId = option.id;
      renderUpgradeCards(summary);
    });
    refs.upgradeCards.appendChild(button);
  }

  const selectedOption = options.find((option) => option.id === app.selectedUpgradeId) ?? null;
  if (!selectedOption || !refs.upgradeDetail) {
    refs.upgradeDetail.hidden = true;
    if (refs.upgradeFeedbackToast) refs.upgradeFeedbackToast.hidden = true;
    return;
  }

  refs.upgradeDetail.hidden = false;
  refs.upgradeDetailCopy.textContent = getUpgradeSummaryText(selectedOption);
  refs.upgradeConfirmButton.disabled = !!selectedOption.disabled;
  refs.upgradeConfirmButton.textContent = `${selectedOption.cost.toFixed(0)} 🍖`;
  refs.upgradeConfirmButton.title = selectedOption.disabled
    ? (selectedOption.shortfall > 0 ? `Need ${selectedOption.shortfall.toFixed(1)} more food` : 'Unavailable')
    : '';
  refs.upgradeConfirmButton.onclick = () => {
    const applied = gameplaySession.applyUpgrade(selectedOption.id, {
      purchaseText: getUpgradePurchaseText(selectedOption),
    });
    if (applied) {
      closeUpgradePanel();
    }
  };

  if (refs.upgradeFeedbackToast) {
    refs.upgradeFeedbackToast.hidden = true;
  }
};

const gameplaySession = createGameplaySession({
  mount: refs.gameCanvasHost,
  onNestSelected: (nest) => {
    app.upgradeNestId = nest?.id ?? null;
    app.selectedUpgradeId = null;
    app.upgradeFeedback = null;
  },
  onFocusAssigned: () => {
    closeUpgradePanel();
  },
  onBattleResolved: (outcome, summary) => {
    app.lastHudSummary = summary;
    if (outcome === 'victory') openVictory();
    else if (outcome === 'defeat') openDefeat();
  },
  onHudUpdate: (summary) => {
    app.lastHudSummary = summary;
    if (refs.antCountValue) refs.antCountValue.textContent = summary ? String(summary.playerAntCount) : '0';
    if (refs.selectedAntBreakdown) {
      const workers = summary?.selectedWorkers ?? 0;
      const fighters = summary?.selectedFighters ?? 0;
      refs.selectedAntBreakdown.textContent = `Sel W ${workers} • F ${fighters}`;
    }
    refs.selectedNestInfo.textContent = summary?.selectedNestText ?? 'Home Nest • Nest HP -- • Stored food --';
    refs.focusInfo.textContent = summary?.focusText ?? 'Focus: No rally point set';
    refs.objectiveInfo.textContent = summary?.objectiveText ?? 'Objective: --';
    refs.battleInfo.textContent = summary?.battleText ?? 'Battle: 0 enemies defeated, 0 ants lost, 0 enemy nests destroyed.';
    refs.foodInfo.textContent = summary?.foodText ?? 'Field food remaining: --';
    renderNestFoodOverlay(summary);
    renderUpgradeCards(summary);
    refs.titleBuildBadge.textContent = summary?.buildText ?? 'Build: --';
    if (refs.hud && refs.hudHint) refs.hudHint.textContent = refs.hud.open ? 'tap to collapse' : 'tap to expand';
  },
  onFatalError: showFatalError,
});

const setCameraMode = (cameraMode) => {
  const nextCameraMode = cameraMode === CAMERA_MODE.battlefield ? CAMERA_MODE.battlefield : CAMERA_MODE.orbit;
  app.cameraMode = nextCameraMode;
  gameplaySession.setCameraMode(nextCameraMode);
  renderDebugMenu();
  return app.cameraMode;
};

const isGameplayVisible = () => [APP_SCREEN.gameplay, APP_SCREEN.victory, APP_SCREEN.defeat].includes(app.screen);

const renderLevelGrid = () => {
  const levels = getLevelsForPage(app.currentPage, app.progress, TOTAL_LEVELS);
  refs.levelGrid.replaceChildren();

  for (const level of levels) {
    const definition = getLevelDefinition(level.levelNumber);
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'levelCard';
    button.dataset.state = level.state;
    button.disabled = level.state === 'locked';
    button.dataset.level = String(level.levelNumber);
    button.dataset.boss = level.isBossLevel ? 'true' : 'false';
    button.innerHTML = `
      <span class="levelCardNumber">${level.levelNumber}</span>
      <span class="levelCardMetaRow">
        ${level.isBossLevel ? `<span class="levelBossBadge">${definition.boss?.icon ?? '👑'} ${definition.boss?.levelCardLabel ?? 'Boss'}</span>` : ''}
        <span class="levelCardMeta">${level.isBossLevel ? (definition.boss?.shellLabel ?? 'Boss level') : definition.timeOfDay}</span>
      </span>
      <span>${definition.label}</span>
      <span class="levelCardState">${level.state}</span>
    `;
    button.addEventListener('click', () => {
      if (level.state === 'locked') return;
      launchLevel(level.levelNumber);
    });
    refs.levelGrid.appendChild(button);
  }

  const range = getPageRange(app.currentPage, TOTAL_LEVELS);
  refs.levelPageLabel.textContent = `Levels ${range.start}–${range.end}`;
  refs.levelProgressLabel.textContent = `Unlocked ${app.progress.unlockedLevel} / ${TOTAL_LEVELS}`;
  refs.previousPageButton.disabled = app.currentPage === 0;
  refs.nextPageButton.disabled = app.currentPage >= getPageCount(TOTAL_LEVELS) - 1;
};

const renderScreens = () => {
  refs.titleScreen.hidden = app.screen !== APP_SCREEN.title;
  refs.levelSelectScreen.hidden = app.screen !== APP_SCREEN.levelSelect;
  refs.victoryScreen.hidden = app.screen !== APP_SCREEN.victory;
  refs.defeatScreen.hidden = app.screen !== APP_SCREEN.defeat;
  refs.gameplayHud.hidden = !isGameplayVisible();
  refs.gameCanvasHost.hidden = !isGameplayVisible();
  if (!isGameplayVisible() && refs.nestUpgradePanel) refs.nestUpgradePanel.hidden = true;
  if (!isGameplayVisible()) closeUpgradePanel();
  document.body.dataset.screen = app.screen;

  const currentLevelDefinition = getCurrentLevelDefinition();
  if (refs.gameplayLevelLabel) {
    refs.gameplayLevelLabel.textContent = currentLevelDefinition.isBossLevel
      ? currentLevelDefinition.boss?.shellLabel ?? `Boss Level ${app.currentLevel}`
      : `Level ${app.currentLevel}`;
  }
  renderNestFoodOverlay(app.lastHudSummary);
  if (refs.hud && refs.hudHint) refs.hudHint.textContent = refs.hud.open ? 'tap to collapse' : 'tap to expand';

  if (app.screen === APP_SCREEN.levelSelect) renderLevelGrid();
};

const changeScreen = async (nextScreen, { restartGameplay = false } = {}) => {
  const wasGameplayVisible = isGameplayVisible();
  app.screen = nextScreen;
  const shouldShowGameplay = isGameplayVisible();

  if ((!shouldShowGameplay && wasGameplayVisible) || (restartGameplay && shouldShowGameplay && wasGameplayVisible)) {
    gameplaySession.stop();
  }

  renderScreens();

  if (shouldShowGameplay && (!wasGameplayVisible || restartGameplay)) {
    await gameplaySession.start(app.currentLevel);
    gameplaySession.setDebugVisualsVisible(app.debugVisualsEnabled);
    gameplaySession.setCameraMode(app.cameraMode);
  }
};

const openLevelSelect = async () => {
  const unlockedPage = Math.floor((app.progress.unlockedLevel - 1) / LEVELS_PER_PAGE);
  app.currentPage = Math.max(0, unlockedPage);
  await changeScreen(APP_SCREEN.levelSelect);
};

const launchLevel = async (levelNumber) => {
  app.currentLevel = levelNumber;
  app.lastHudSummary = null;
  await changeScreen(APP_SCREEN.gameplay, { restartGameplay: true });
};

const openVictory = async () => {
  app.progress = completeLevel(app.progress, app.currentLevel, TOTAL_LEVELS);
  saveCampaignProgress(app.progress);

  const nextLevel = Math.min(TOTAL_LEVELS, app.currentLevel + 1);
  const levelDefinition = getCurrentLevelDefinition();
  refs.victoryKicker.textContent = levelDefinition.isBossLevel ? 'Boss defeated' : 'Victory';
  refs.victoryScreen.querySelector('.overlayPanel')?.setAttribute('data-boss', levelDefinition.isBossLevel ? 'true' : 'false');
  refs.victoryLevelLabel.textContent = levelDefinition.isBossLevel
    ? `${levelDefinition.boss?.shellLabel ?? `Boss Level ${app.currentLevel}`} complete`
    : `Level ${app.currentLevel} complete`;
  refs.victorySummary.textContent = `${app.lastHudSummary?.objectiveCompletionText ?? 'Objective complete.'} ${levelDefinition.boss?.victorySummary ?? ''} You reached ${app.lastHudSummary?.maxPlayerAntCount ?? app.lastHudSummary?.playerAntCount ?? 0} player ants, defeated ${app.lastHudSummary?.enemyAntsDefeated ?? 0} enemies, and destroyed ${app.lastHudSummary?.enemyNestsDestroyed ?? 0} enemy nests. Level ${nextLevel <= TOTAL_LEVELS ? nextLevel : app.currentLevel} is now available.`.trim();
  refs.nextLevelButton.disabled = app.currentLevel >= TOTAL_LEVELS;
  refs.nextLevelButton.textContent = app.currentLevel >= TOTAL_LEVELS ? 'Campaign Complete' : `Play Level ${nextLevel}`;
  await changeScreen(APP_SCREEN.victory);
};

const openDefeat = async () => {
  const levelDefinition = getCurrentLevelDefinition();
  refs.defeatKicker.textContent = levelDefinition.isBossLevel ? 'Boss attempt failed' : 'Defeat';
  refs.defeatScreen.querySelector('.overlayPanel')?.setAttribute('data-boss', levelDefinition.isBossLevel ? 'true' : 'false');
  refs.defeatLevelLabel.textContent = levelDefinition.isBossLevel
    ? `${levelDefinition.boss?.shellLabel ?? `Boss Level ${app.currentLevel}`} failed`
    : `Level ${app.currentLevel} failed`;
  refs.defeatSummary.textContent = `${levelDefinition.boss?.defeatSummary ?? ''} Max player ants: ${app.lastHudSummary?.maxPlayerAntCount ?? app.lastHudSummary?.playerAntCount ?? 0}. Enemies defeated: ${app.lastHudSummary?.enemyAntsDefeated ?? 0}. Player nests lost: ${app.lastHudSummary?.playerNestsLost ?? 0}. Try again or head back to level select.`.trim();
  await changeScreen(APP_SCREEN.defeat);
};

refs.startButton.addEventListener('click', () => {
  openLevelSelect();
});
refs.titleTapTarget.addEventListener('click', () => {
  openLevelSelect();
});
refs.backToTitleButton.addEventListener('click', () => {
  changeScreen(APP_SCREEN.title);
});
refs.previousPageButton.addEventListener('click', () => {
  app.currentPage = Math.max(0, app.currentPage - 1);
  renderLevelGrid();
});
refs.nextPageButton.addEventListener('click', () => {
  app.currentPage = Math.min(getPageCount(TOTAL_LEVELS) - 1, app.currentPage + 1);
  renderLevelGrid();
});
refs.returnToLevelSelectButton.addEventListener('click', () => {
  openLevelSelect();
});
refs.cameraModeButton?.addEventListener('click', () => {
  setCameraMode(app.cameraMode === CAMERA_MODE.battlefield ? CAMERA_MODE.orbit : CAMERA_MODE.battlefield);
});
refs.nextLevelButton.addEventListener('click', () => {
  if (app.currentLevel >= TOTAL_LEVELS) return;
  launchLevel(Math.min(TOTAL_LEVELS, app.currentLevel + 1));
});
refs.victoryLevelSelectButton.addEventListener('click', () => {
  openLevelSelect();
});
refs.retryLevelButton.addEventListener('click', () => {
  launchLevel(app.currentLevel);
});
refs.defeatLevelSelectButton.addEventListener('click', () => {
  openLevelSelect();
});
refs.hud?.addEventListener('toggle', () => {
  if (refs.hudHint) refs.hudHint.textContent = refs.hud.open ? 'tap to collapse' : 'tap to expand';
});
refs.debugCameraOrbitButton?.addEventListener('click', () => {
  setCameraMode(CAMERA_MODE.orbit);
});
refs.debugCameraBattlefieldButton?.addEventListener('click', () => {
  setCameraMode(CAMERA_MODE.battlefield);
});
refs.debugVisualsButton?.addEventListener('click', () => {
  app.debugVisualsEnabled = !app.debugVisualsEnabled;
  gameplaySession.setDebugVisualsVisible(app.debugVisualsEnabled);
  renderDebugMenu();
});

window.__ANT_BATTLE_TEST_API__ = {
  forceOutcome(outcome) {
    if (outcome === 'victory') {
      openVictory();
      return true;
    }
    if (outcome === 'defeat') {
      openDefeat();
      return true;
    }
    return false;
  },
  getCameraMode() {
    return app.cameraMode;
  },
  getCameraProjectionType() {
    return gameplaySession.getCameraProjectionType();
  },
  getCameraState() {
    return gameplaySession.getCameraState();
  },
  setBattlefieldCameraZoom(zoom) {
    return gameplaySession.setBattlefieldCameraZoom(zoom);
  },
  setBattlefieldCameraTarget(target) {
    return gameplaySession.setBattlefieldCameraTarget(target);
  },
  rotateBattlefieldCamera(azimuthDelta) {
    return gameplaySession.rotateBattlefieldCamera(azimuthDelta);
  },
  isDebugMenuVisible() {
    return app.debugMenuVisible;
  },
  setSelectedNest(nestId) {
    const changed = gameplaySession.setSelectedNest(nestId);
    if (changed) {
      app.upgradeNestId = nestId;
      app.selectedUpgradeId = null;
      app.upgradeFeedback = null;
    }
    return changed;
  },
  setNestStored(nestId, amount) {
    return gameplaySession.setNestStored(nestId, amount);
  },
  getUpgradeOptions(nestId) {
    return gameplaySession.getUpgradeOptions(nestId);
  },
  selectUpgrade(upgradeId) {
    app.selectedUpgradeId = upgradeId;
    renderUpgradeCards(app.lastHudSummary);
    return app.selectedUpgradeId;
  },
};

window.__ANT_BATTLE_DEV_API__ = {
  setDebugVisualsVisible(visible) {
    app.debugVisualsEnabled = !!visible;
    gameplaySession.setDebugVisualsVisible(app.debugVisualsEnabled);
    renderDebugMenu();
    return app.debugVisualsEnabled;
  },
  getDebugVisualsVisible() {
    return app.debugVisualsEnabled;
  },
  setDebugMenuVisible(visible) {
    app.debugMenuVisible = !!visible;
    renderDebugMenu();
    return app.debugMenuVisible;
  },
  getDebugMenuVisible() {
    return app.debugMenuVisible;
  },
  setCameraMode(cameraMode) {
    return setCameraMode(cameraMode);
  },
  getCameraMode() {
    return app.cameraMode;
  },
};

refs.titleBuildBadge.textContent = `Build: ${BUILD_ID}`;
renderDebugMenu();
renderScreens();

if (shouldAutoStartDebugLevel()) {
  launchLevel(1);
}
