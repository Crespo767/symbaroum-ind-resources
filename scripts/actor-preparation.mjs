import { MODULE_ID } from "./constants.mjs";
import { CompatibilityService } from "./compatibility.mjs";

/**
 * Único dono dos wrappers de prepareBaseData/prepareDerivedData do ator do sistema.
 * O libWrapper aceita um só wrapper por método e por módulo; as funcionalidades
 * registram aqui suas regras em vez de embrulhar o método de novo.
 */
const skipChecks = [];
const derivedSteps = [];
let installed = false;

export const ActorPreparation = {
  /** O sistema não prepara atores para os quais `predicate(actor)` é verdadeiro (ex.: Grupo). */
  skipSystemPreparation(predicate) {
    skipChecks.push(predicate);
    this.install();
  },

  /** `step(actor)` roda depois do prepareDerivedData do sistema, para atores não ignorados. */
  afterDerivedData(step) {
    derivedSteps.push(step);
    this.install();
  },

  install() {
    if (installed) return;
    const prototype = globalThis.CONFIG?.Actor?.documentClass?.prototype;
    if (!prototype) return;
    installed = true;
    wrap(prototype, "prepareBaseData", function(wrapped, ...args) {
      if (shouldSkip(this)) return undefined;
      return wrapped.apply(this, args);
    });
    wrap(prototype, "prepareDerivedData", function(wrapped, ...args) {
      if (shouldSkip(this)) return undefined;
      const result = wrapped.apply(this, args);
      for (const step of derivedSteps) {
        try {
          step(this);
        } catch (error) {
          console.error(`${MODULE_ID} | Actor derived data step failed for ${this?.name}.`, error);
        }
      }
      return result;
    });
  }
};

function shouldSkip(actor) {
  return skipChecks.some((predicate) => predicate(actor));
}

// Os atores são preparados antes do hook "setup": isto precisa rodar já no "init".
function wrap(prototype, method, wrapper) {
  if (CompatibilityService.canUseLibWrapper()) {
    try {
      globalThis.libWrapper.register(MODULE_ID, `CONFIG.Actor.documentClass.prototype.${method}`, wrapper, "MIXED");
      return;
    } catch (error) {
      console.warn(`${MODULE_ID} | libWrapper unavailable for ${method}; patching directly.`, error);
    }
  }
  const original = prototype[method];
  if (!original) return;
  prototype[method] = function tenebreActorPreparation(...args) {
    return wrapper.call(this, original, ...args);
  };
}
