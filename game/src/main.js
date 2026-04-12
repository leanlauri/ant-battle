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
  gameplayLevelLabel: document.getElementById('gameplayLevelLabel'),
  hud: document.getElementById('hud'),
  hudHint: document.getElementById('hudHint'),
  cameraInfo: document.getElementById('cameraInfo'),
  meshInfo: document.getElementById('meshInfo'),
  antInfo: document.getElementById('antInfo'),
  selectedNestInfo: document.getElementById('selectedNestInfo'),
  focusInfo: document.getElementById('focusInfo'),
  objectiveInfo: document.getElementById('objectiveInfo'),
  battleInfo: document.getElementById('battleInfo'),
  foodInfo: document.getElementById('foodInfo'),
  buildInfo: document.getElementById('buildInfo'),
  upgradeCards: document.getElementById('upgradeCards'),
  debugVisualsToggle: document.getElementById('debugVisualsToggle'),
  returnToLevelSelectButton: document.getElementById('returnToLevelSelectButton'),
  victoryLevelLabel: document.getElementById('victoryLevelLabel'),
  victorySummary: document.getElementById('victorySummary'),
  nextLevelButton: document.getElementById('nextLevelButton'),
  victoryLevelSelectButton: document.getElementById('victoryLevelSelectButton'),
  defeatLevelLabel: document.getElementById('defeatLevelLabel'),
  defeatSummary: document.getElementById('defeatSummary'),
  retryLevelButton: document.getElementById('retryLevelButton'),
  defeatLevelSelectButton: document.getElementById('defeatLevelSelectButton'),
};

const app = {
  screen: APP_SCREEN.title,
  currentLevel: 1,
  currentPage: 0,
  progress: loadCampaignProgress() || createDefaultCampaignProgress(),
  lastHudSummary: null,
};

const renderUpgradeCards = (summary) => {
  if (!refs.upgradeCards) return;
  refs.upgradeCards.replaceChildren();
  const options = summary?.upgradeOptions ?? [];
  if (!options.length) {
    const empty = document.createElement('div');
    empty.className = 'upgradeCardCopy';
    empty.textContent = 'Select a player nest to see upgrades.';
    refs.upgradeCards.appendChild(empty);
    return;
  }

  for (const option of options) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'upgradeCard';
    button.disabled = !!option.disabled;
    button.dataset.upgradeId = option.id;
    button.innerHTML = `
      <div class="upgradeCardTitle">
        <span>${option.label}</span>
        <span>${option.cost.toFixed(0)} food</span>
      </div>
      <div class="upgradeCardCopy">${option.description}${option.shortfall > 0 ? ` Need ${option.shortfall.toFixed(1)} more food.` : ''}</div>
    `;
    button.addEventListener('click', () => {
      gameplaySession.applyUpgrade(option.id);
    });
    refs.upgradeCards.appendChild(button);
  }
};

const gameplaySession = createGameplaySession({
  mount: refs.gameCanvasHost,
  onNestSelected: () => {},
  onFocusAssigned: () => {},
  onBattleResolved: (outcome, summary) => {
    app.lastHudSummary = summary;
    if (outcome === 'victory') openVictory();
    else if (outcome === 'defeat') openDefeat();
  },
  onHudUpdate: (summary) => {
    app.lastHudSummary = summary;
    refs.antCountValue.textContent = summary ? String(summary.playerAntCount) : '0';
    refs.cameraInfo.textContent = summary?.cameraText ?? 'Camera: waiting for gameplay...';
    refs.meshInfo.textContent = summary?.terrainText ?? 'Terrain: --';
    refs.antInfo.textContent = summary?.antText ?? 'Ants: --';
    refs.selectedNestInfo.textContent = summary?.selectedNestText ?? 'Selected nest: Home Nest';
    refs.focusInfo.textContent = summary?.focusText ?? 'Focus: none';
    refs.objectiveInfo.textContent = summary?.objectiveText ?? 'Objective: --';
    refs.battleInfo.textContent = summary?.battleText ?? 'Battle: 0 enemy down, 0 player lost, 0 enemies still active.';
    refs.foodInfo.textContent = summary?.foodText ?? 'Food: --';
    refs.buildInfo.textContent = summary?.buildText ?? 'Build: --';
    renderUpgradeCards(summary);
    refs.titleBuildBadge.textContent = summary?.buildText ?? 'Build: --';
    if (refs.hud && refs.hudHint) refs.hudHint.textContent = refs.hud.open ? 'tap to collapse' : 'tap to expand';
  },
  onFatalError: showFatalError,
});

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
    button.innerHTML = `
      <span class="levelCardNumber">${level.levelNumber}</span>
      <span class="levelCardMeta">${level.isBossLevel ? 'Wasp' : definition.timeOfDay} • ${definition.label}</span>
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
  document.body.dataset.screen = app.screen;

  refs.gameplayLevelLabel.textContent = `Level ${app.currentLevel}`;
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
    gameplaySession.setDebugVisualsVisible(refs.debugVisualsToggle.checked);
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
  refs.victoryLevelLabel.textContent = `Level ${app.currentLevel} complete`;
  refs.victorySummary.textContent = `You reached ${app.lastHudSummary?.maxPlayerAntCount ?? app.lastHudSummary?.playerAntCount ?? 0} player ants, defeated ${app.lastHudSummary?.enemyAntsDefeated ?? 0} enemies, and destroyed ${app.lastHudSummary?.enemyNestsDestroyed ?? 0} enemy nests. Level ${nextLevel <= TOTAL_LEVELS ? nextLevel : app.currentLevel} is now available.`;
  refs.nextLevelButton.disabled = app.currentLevel >= TOTAL_LEVELS;
  refs.nextLevelButton.textContent = app.currentLevel >= TOTAL_LEVELS ? 'Campaign Complete' : `Play Level ${nextLevel}`;
  await changeScreen(APP_SCREEN.victory);
};

const openDefeat = async () => {
  refs.defeatLevelLabel.textContent = `Level ${app.currentLevel} failed`;
  refs.defeatSummary.textContent = `Max player ants: ${app.lastHudSummary?.maxPlayerAntCount ?? app.lastHudSummary?.playerAntCount ?? 0}. Enemies defeated: ${app.lastHudSummary?.enemyAntsDefeated ?? 0}. Player nests lost: ${app.lastHudSummary?.playerNestsLost ?? 0}. Try again or head back to level select.`;
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
refs.debugVisualsToggle.addEventListener('change', () => {
  gameplaySession.setDebugVisualsVisible(refs.debugVisualsToggle.checked);
});
refs.returnToLevelSelectButton.addEventListener('click', () => {
  openLevelSelect();
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
};

refs.titleBuildBadge.textContent = 'Build: --';
renderScreens();
