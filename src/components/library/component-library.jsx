(function (global) {
  'use strict';

  var COMPONENTS = [
    { type: 'Trigger', description: 'Starts a workflow from an event.' },
    { type: 'Action', description: 'Performs an operation or mutation.' },
    { type: 'Condition', description: 'Branches workflow paths.' },
    { type: 'Data', description: 'Reads or writes data resources.' },
    { type: 'Notification', description: 'Sends user or system alerts.' }
  ];

  function renderLibrary(container, options) {
    if (!container) return;
    options = options || {};

    container.innerHTML = COMPONENTS.map(function (component) {
      return [
        '<button class="lh-lib-item' + (options.mobileCards ? ' lh-mobile-tool-card' : '') + '" draggable="true" data-component-type="' + component.type + '">',
        '<strong>' + component.type + '</strong>',
        '<span>' + component.description + '</span>',
        '</button>'
      ].join('');
    }).join('');

    Array.prototype.forEach.call(container.querySelectorAll('[data-component-type]'), function (item) {
      item.addEventListener('dragstart', function (event) {
        event.dataTransfer.setData('text/plain', item.dataset.componentType);
        event.dataTransfer.effectAllowed = 'copy';
      });
      item.addEventListener('click', function () {
        if (typeof options.onItemSelected === 'function') {
          options.onItemSelected(item.dataset.componentType);
        }
      });
    });
  }

  global.LogicHubStudioLibrary = {
    renderLibrary: renderLibrary
  };
})(window);
