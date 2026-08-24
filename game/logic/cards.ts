/**
 * Stable CardLogic compatibility facade.
 *
 * Runtime services are composed once at module activation. The implementation
 * factory never imports the composer or this facade, keeping the construction
 * graph acyclic while preserving the historical CommonJS export identity.
 */
import { getDefaultCardRuntimeServices } from './card-runtime-composer';
import createCardLogicRuntime = require('./cards-runtime-factory');

const CardLogic = createCardLogicRuntime(getDefaultCardRuntimeServices());

export = CardLogic;
