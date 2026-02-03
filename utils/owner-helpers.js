(function (root) {
    'use strict';

    // Minimal Owner Helpers stub for browser and headless
    function getOwnerDisplayName(owner) {
        if (owner === 1 || owner === '1' || owner === 'black') return 'black';
        if (owner === -1 || owner === '-1' || owner === 'white') return 'white';
        return null;
    }

    function isValidOwner(owner) {
        return owner === 1 || owner === -1 || owner === '1' || owner === '-1' || owner === 'black' || owner === 'white';
    }

    var OwnerHelpers = {
        getOwnerDisplayName: getOwnerDisplayName,
        isValidOwner: isValidOwner
    };

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = OwnerHelpers;
    }
    try { if (typeof window !== 'undefined') window.OwnerHelpers = OwnerHelpers; } catch (e) {}
})(typeof self !== 'undefined' ? self : this);
