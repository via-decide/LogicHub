(function (global) {
  'use strict';

  var COMPONENT_CATEGORIES = [
    { name: 'Layout', items: [{ type: 'Section', description: 'Top-level layout area for a page.' }, { type: 'Container', description: 'Groups content with spacing and bounds.' }, { type: 'Grid', description: 'Creates responsive columns and rows.' }] },
    { name: 'Content', items: [{ type: 'Text', description: 'Rich text block for headings and body copy.' }, { type: 'Image', description: 'Displays an image with alt text support.' }, { type: 'Video', description: 'Embeds hosted or uploaded video.' }] },
    { name: 'Inputs', items: [{ type: 'Button', description: 'Triggers actions, links, or workflows.' }, { type: 'Form', description: 'Collects user input and submission data.' }, { type: 'Search', description: 'Adds searchable query input.' }] },
    { name: 'Data', items: [{ type: 'List', description: 'Renders repeating content from data.' }, { type: 'Table', description: 'Displays structured rows and columns.' }, { type: 'Chart', description: 'Visualizes metrics and trends.' }] },
    { name: 'Commerce', items: [{ type: 'Product Card', description: 'Showcases product details and price.' }, { type: 'Cart', description: 'Collects selected products for checkout.' }] }
  ];

  function renderLibrary(container, options) {
    if (!container) return;
    options = options || {};

    container.innerHTML = COMPONENT_CATEGORIES.map(function (category) {
      return [
        '<section class="lh-lib-category">',
        '<h4>' + category.name + '</h4>',
        category.items.map(function (component) {
          return [
            '<button class="lh-lib-item' + (options.mobileCards ? ' lh-mobile-tool-card' : '') + '" draggable="true" data-component-type="' + component.type + '">',
            '<strong>' + component.type + '</strong>',
            '<span>' + component.description + '</span>',
            '</button>'
          ].join('');
        }).join(''),
        '</section>'
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
