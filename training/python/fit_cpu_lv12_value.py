"""Small public-state value fit. No runtime dependency on Python or NumPy.

Grouped validation prevents paired games or adjacent positions from crossing
folds. Game-balanced regularized logistic regression has no color intercept.
"""
import hashlib
import json
import pathlib
import sys
import numpy as np


def sigmoid(z):
    return 1.0 / (1.0 + np.exp(-np.clip(z, -35, 35)))


def fit(x, y, weights, prior, regularization):
    weights = weights / weights.sum()
    scale = np.maximum(1.0, np.sqrt(np.sum(weights[:, None] * x * x, axis=0)))
    design = x / scale
    center = prior * scale / 32.0
    beta = center.copy()

    def objective(value):
        z = design @ value
        return (np.sum(weights * (np.logaddexp(0, z) - y * z))
                + regularization * np.sum((value - center) ** 2) / 2)

    for _ in range(40):
        probability = sigmoid(design @ beta)
        gradient = design.T @ (weights * (probability - y)) + regularization * (beta - center)
        hessian = (design.T * (weights * probability * (1 - probability))) @ design
        hessian += np.eye(x.shape[1]) * regularization
        step = np.linalg.solve(hessian, gradient)
        rate, old = 1.0, objective(beta)
        while rate > 1e-6 and objective(beta - rate * step) > old:
            rate *= .5
        beta -= rate * step
        if np.max(np.abs(rate * step)) < 1e-7:
            break
    return beta / scale * 32.0


def metrics(x, y, weights, coefficients):
    weights = weights / weights.sum()
    z = np.clip(x @ coefficients / 32.0, -6, 6)
    probability = sigmoid(z)
    return {'logLoss': float(np.sum(weights * (np.logaddexp(0, z) - y * z))),
            'brier': float(np.sum(weights * (probability - y) ** 2))}


def main():
    source, destination = map(pathlib.Path, sys.argv[1:3])
    if destination.exists():
        raise ValueError('Fit output already exists')
    data = json.loads(source.read_text(encoding='utf-8'))
    rows, games = data['rows'], data['games']
    x = np.asarray([row['x'] for row in rows], dtype=np.float64)
    y = np.asarray([row['y'] for row in rows], dtype=np.float64)
    weights = np.asarray([1.0 / games[row['game']]['rows'] for row in rows])
    prior = np.asarray(data['priorWeights'], dtype=np.float64)
    groups = sorted(set(row['group'] for row in rows), key=int)
    if len(groups) < 8 or not np.isfinite(x).all() or not np.isin(y, [0, .5, 1]).all():
        raise ValueError('Training preflight failed')
    folds_by_group = {group: index % 4 for index, group in enumerate(groups)}
    folds = np.asarray([folds_by_group[row['group']] for row in rows])
    validation = []
    feature_sets = {'base': list(range(10)), 'board-and-tempo': list(range(20)),
                    'all': list(range(x.shape[1]))}
    for feature_set, active in feature_sets.items():
        for regularization in [.003, .01, .03, .1, .3, 1.0]:
            reports = []
            for fold in range(4):
                train, test = folds != fold, folds == fold
                coefficients = np.zeros(x.shape[1])
                coefficients[active] = fit(x[train][:, active], y[train], weights[train], prior[active], regularization)
                reports.append(metrics(x[test], y[test], weights[test], coefficients))
            validation.append({'featureSet': feature_set, 'regularization': regularization, 'folds': reports,
                               'meanLogLoss': float(np.mean([v['logLoss'] for v in reports])),
                               'meanBrier': float(np.mean([v['brier'] for v in reports]))})
    selected = min(validation, key=lambda report: report['meanLogLoss'])
    active = feature_sets[selected['featureSet']]
    coefficients = np.zeros(x.shape[1])
    coefficients[active] = fit(x[:, active], y, weights, prior[active], selected['regularization'])
    baseline_folds = [metrics(x[folds == fold], y[folds == fold], weights[folds == fold], prior) for fold in range(4)]
    report = {'schema': 'cpu-lv12-value-fit.v1', 'datasetSha256': hashlib.sha256(source.read_bytes()).hexdigest(),
              'games': len(games), 'groups': len(groups), 'rows': len(rows),
              'featureNames': data['featureNames'], 'weights': coefficients.tolist(),
              'validation': validation, 'selectedRegularization': selected['regularization'],
              'selectedFeatureSet': selected['featureSet'], 'baselineFolds': baseline_folds,
              'baselineMeanLogLoss': float(np.mean([v['logLoss'] for v in baseline_folds])),
              'baseline': metrics(x, y, weights, prior), 'training': metrics(x, y, weights, coefficients),
              'foldsByGroup': folds_by_group,
              'method': 'Game-balanced prior-regularized logistic regression; four paired-condition folds; no intercept',
              'limitations': 'Historical-policy outcomes; validation loss is not match win rate or adoption evidence'}
    with destination.open('x', encoding='utf-8') as stream:
        json.dump(report, stream, indent=2)
    print(json.dumps({key: report[key] for key in ['games', 'groups', 'rows', 'selectedRegularization', 'baseline', 'training']}))
    print(json.dumps({'selectedValidation': selected}))


if __name__ == '__main__':
    main()
