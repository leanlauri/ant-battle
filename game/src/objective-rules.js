export const OBJECTIVE_TYPE = Object.freeze({
  destroyAllEnemyNests: 'destroy-all-enemy-nests',
  destroyTargetNest: 'destroy-target-nest',
});

const getTargetNest = (foodSystem, objective) => {
  if (!foodSystem || !objective?.targetNestId) return null;
  return foodSystem.getNestById?.(objective.targetNestId) ?? null;
};

export const getObjectiveStatus = ({ objective, foodSystem } = {}) => {
  const activeEnemyNests = foodSystem?.getActiveEnemyNestCount?.() ?? 0;

  if (objective?.type === OBJECTIVE_TYPE.destroyTargetNest) {
    const targetNest = getTargetNest(foodSystem, objective);
    const targetDestroyed = !targetNest || !!targetNest.collapsed;
    const targetLabel = objective.targetLabel ?? targetNest?.label ?? 'Target Nest';
    return {
      complete: targetDestroyed,
      targetDestroyed,
      remainingEnemyNests: activeEnemyNests,
      hudText: targetDestroyed
        ? `Objective: ${targetLabel} destroyed.`
        : `Objective: Destroy ${targetLabel}.${objective.rulesText ? ` ${objective.rulesText}` : ''}`,
      battleSuffix: targetDestroyed
        ? `${targetLabel} destroyed.`
        : `${targetLabel} still stands, ${activeEnemyNests} enemy nest${activeEnemyNests === 1 ? '' : 's'} active.`,
      completionText: objective.completionText ?? `Destroyed ${targetLabel}.`,
    };
  }

  const remaining = activeEnemyNests;
  const complete = remaining === 0;
  return {
    complete,
    targetDestroyed: complete,
    remainingEnemyNests: remaining,
    hudText: complete
      ? 'Objective: All hostile nests destroyed.'
      : `Objective: Destroy all hostile nests.${objective?.rulesText ? ` ${objective.rulesText}` : ''}`,
    battleSuffix: complete
      ? 'All hostile nests destroyed.'
      : `${remaining} enemy nest${remaining === 1 ? '' : 's'} still active.`,
    completionText: objective?.completionText ?? 'Destroyed all hostile nests.',
  };
};

export const resolveObjectiveOutcome = ({ objective, foodSystem } = {}) => {
  const activePlayerNests = foodSystem?.getActivePlayerNestCount?.() ?? 0;
  if (activePlayerNests === 0) return 'defeat';
  return getObjectiveStatus({ objective, foodSystem }).complete ? 'victory' : null;
};
