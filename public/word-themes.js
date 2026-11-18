/*
 * Catálogo único de grupos de palabras (RF-002.01, APR-008).
 * Lo cargan el navegador (global `FarsanteWordThemes`) y el servidor (`require`).
 * Nombre visible del grupo Scrum sujeto a D-30.
 */
(function (root, factory) {
  'use strict';
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.FarsanteWordThemes = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var groups = [
    {
      id: 'scrum',
      label: 'Scrum y equipo',
      emoji: '🔁',
      words: ['Planning', 'Review', 'Daily', 'Retro', 'Historia de Usuario', 'QA', 'DEV', 'Refinamiento', 'Sprint', 'Backlog'],
    },
    {
      id: 'comida',
      label: 'Comida',
      emoji: '🍕',
      words: ['Pizza', 'Hamburguesa', 'Arepa', 'Empanada', 'Sushi', 'Tacos', 'Pasta', 'Ensalada', 'Chocolate', 'Helado'],
    },
    {
      id: 'musica',
      label: 'Música',
      emoji: '🎵',
      words: ['Salsa', 'Reguetón', 'Rock', 'Pop', 'Bachata', 'Vallenato', 'Concierto', 'Guitarra', 'Karaoke', 'Playlist'],
    },
    {
      id: 'tecnologia',
      label: 'Tecnología e IA',
      emoji: '🤖',
      words: ['Inteligencia Artificial', 'Chatbot', 'Prompt', 'Algoritmo', 'Automatización', 'Nube', 'Ciberseguridad', 'Robot', 'Datos', 'Realidad Virtual'],
    },
  ];

  groups.forEach(function (group) {
    Object.freeze(group.words);
    Object.freeze(group);
  });

  return Object.freeze({
    DEFAULT_GROUP_ID: 'scrum',
    groups: Object.freeze(groups),
    getGroup: function (id) {
      for (var i = 0; i < groups.length; i += 1) {
        if (groups[i].id === id) return groups[i];
      }
      return null;
    },
  });
});
