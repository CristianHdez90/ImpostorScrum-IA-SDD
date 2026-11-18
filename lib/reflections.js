'use strict';

const { foldKey } = require('./text');

/**
 * Contenido editorial de RF-007 (prompt maestro). Se envía solo en `finished`.
 * QA y DEV son términos del equipo, no ceremonias oficiales de Scrum.
 */
const SCRUM = {
  Planning: ['Construimos un propósito compartido.', '¿Qué debemos aclarar antes de comprometernos para comprender el objetivo y el trabajo del Sprint?'],
  Review: ['Aprendemos con los interesados sobre lo construido.', '¿Qué feedback necesitamos escuchar y cómo lo convertiremos en decisiones de producto?'],
  Daily: ['Coordinamos el trabajo hacia el objetivo.', '¿Cómo podemos pedir ayuda y ajustar nuestro plan además de contar lo realizado?'],
  Retro: ['Transformamos la experiencia en mejora.', '¿Qué cambio concreto probaremos y cómo sabremos si funcionó?'],
  'Historia de Usuario': ['Conectamos el trabajo con una necesidad.', '¿Para quién construimos, qué necesita y cómo comprobaremos el valor?'],
  QA: ['La calidad es compartida.', '¿Cómo involucramos a QA desde el inicio para prevenir defectos?'],
  DEV: ['El desarrollo requiere contexto y colaboración.', '¿Qué haremos para compartir conocimiento y evitar trabajo aislado?'],
  Refinamiento: ['Descubrimos dudas y dividimos trabajo.', '¿Qué necesitamos conversar antes de llevar una historia a Planning?'],
  Sprint: ['Nos enfocamos, construimos y aprendemos.', '¿Qué nos distrae del objetivo y cómo protegemos el enfoque?'],
  Backlog: ['Hacemos visibles opciones y prioridades.', '¿Qué aporta más valor y qué deberíamos ordenar, aclarar o descartar?'],
};

const GENERAL = [
  '¿Qué ocurrió cuando alguien no tenía toda la información?',
  '¿Qué acuerdo concreto nos ayudaría a compartir contexto y colaborar mejor?',
];

const BY_KEY = new Map(Object.entries(SCRUM).map(([word, pair]) => [foldKey(word), pair]));

/** Reflexión específica para una palabra Scrum o la general para cualquier otra. */
function reflectionFor(word) {
  const specific = BY_KEY.get(foldKey(word));
  const [text, question] = specific ?? GENERAL;
  return { kind: specific ? 'scrum' : 'general', text, question };
}

module.exports = { reflectionFor, SCRUM_REFLECTIONS: SCRUM, GENERAL_REFLECTION: GENERAL };
