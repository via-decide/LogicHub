(function (global) {
  'use strict';

  function setupNodeEditor(context) {
    var form = context.nodeEditorForm;
    var titleInput = form.querySelector('[name="title"]');
    var descriptionInput = form.querySelector('[name="description"]');
    var helper = context.nodeEditorHelper;

    form.addEventListener('input', function () {
      if (!context.state.selectedNodeId) return;

      global.LogicHubStudioGraph.updateNode(context.state, context.state.selectedNodeId, {
        title: titleInput.value,
        description: descriptionInput.value
      });

      global.LogicHubStudioCanvas.renderCanvasElements(context);
      context.onStateChange();
    });

    context.syncEditor = function syncEditor() {
      var node = context.state.selectedNodeId
        ? global.LogicHubStudioGraph.getNodeById(context.state, context.state.selectedNodeId)
        : null;

      if (!node) {
        form.reset();
        titleInput.disabled = true;
        descriptionInput.disabled = true;
        helper.textContent = 'Select a node on the canvas to edit its label and details.';
        return;
      }

      titleInput.disabled = false;
      descriptionInput.disabled = false;
      titleInput.value = node.title;
      descriptionInput.value = node.description;
      helper.textContent = 'Editing ' + node.id + ' (' + node.type + ').';
    };

    context.syncEditor();
  }

  global.LogicHubStudioNodeEditor = {
    setupNodeEditor: setupNodeEditor
  };
})(window);
