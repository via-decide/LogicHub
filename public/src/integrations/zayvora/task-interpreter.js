(function (global) {
  'use strict';

  function uniqueValues(values) {
    return values.filter(function (value, index) {
      return values.indexOf(value) === index;
    });
  }

  function deriveGoal(reasoning) {
    if (reasoning.intent === 'support') return 'Automate customer support routing';
    if (reasoning.intent === 'commerce') return 'Automate commerce event handling';
    if (reasoning.intent === 'onboarding') return 'Automate onboarding journey';
    if (reasoning.intent === 'security') return 'Automate security response';
    return 'Automate prompt-defined workflow';
  }

  function buildSteps(reasoning) {
    var actions = uniqueValues(reasoning.entities.actions).slice(0, 2);
    var resources = uniqueValues(reasoning.entities.resources).slice(0, 2);

    var steps = [
      { type: 'Trigger', title: 'Prompt Trigger', description: 'Begins workflow from user prompt context.' }
    ];

    resources.forEach(function (resource) {
      steps.push({
        type: 'Data',
        title: 'Load ' + resource,
        description: 'Fetches ' + resource + ' records for execution.'
      });
    });

    steps.push({
      type: 'Condition',
      title: 'Intent: ' + reasoning.intent,
      description: 'Routes based on inferred intent with confidence ' + Math.round(reasoning.confidence * 100) + '%. '
    });

    if (actions.length) {
      actions.forEach(function (action, index) {
        steps.push({
          type: 'Action',
          title: action.charAt(0).toUpperCase() + action.slice(1) + ' Task',
          description: index === 0
            ? 'Executes the primary inferred action from prompt reasoning.'
            : 'Executes additional inferred action from prompt reasoning.'
        });
      });
    } else {
      steps.push({
        type: 'Action',
        title: 'Run Task',
        description: 'Executes automation logic generated from prompt intent.'
      });
    }

    steps.push({
      type: 'Notification',
      title: 'Share Result',
      description: 'Publishes generated outcome to builder preview consumers.'
    });

    return steps;
  }

  function interpretReasoning(reasoning) {
    return {
      goal: deriveGoal(reasoning),
      prompt: reasoning.prompt,
      metadata: {
        intent: reasoning.intent,
        confidence: reasoning.confidence,
        entities: reasoning.entities
      },
      steps: buildSteps(reasoning)
    };
  }

  global.LogicHubTaskInterpreter = {
    interpretReasoning: interpretReasoning
  };
})(window);
