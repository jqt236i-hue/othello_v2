const {
    TRACKED_ARTIFACT_ALLOWLIST,
    parseTrackedArtifactPaths,
    findUnexpectedTrackedArtifacts
} = require('../scripts/check-artifact-retention');

describe('artifact retention guard', () => {
    test('has an intentionally empty tracked artifact allowlist', () => {
        expect(TRACKED_ARTIFACT_ALLOWLIST).toEqual([]);
    });

    test('accepts an empty git artifact listing', () => {
        expect(findUnexpectedTrackedArtifacts(parseTrackedArtifactPaths(''))).toEqual([]);
    });

    test('rejects every tracked path below artifacts', () => {
        const listed = parseTrackedArtifactPaths(
            'artifacts/browser-profile/Cache/data\nartifacts/historical-report.json\n'
        );

        expect(findUnexpectedTrackedArtifacts(listed)).toEqual([
            'artifacts/browser-profile/Cache/data',
            'artifacts/historical-report.json'
        ]);
    });
});
