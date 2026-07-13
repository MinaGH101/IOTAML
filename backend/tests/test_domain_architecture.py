from pathlib import Path


def test_main_registers_domain_routers_directly() -> None:
    source = Path(__file__).parents[1] / 'app' / 'main.py'
    text = source.read_text(encoding='utf-8')
    assert 'app.domains.artifacts.routes' in text
    assert 'app.domains.datasets.routes' in text
    assert 'app.domains.projects.routes' in text
    assert 'app.api.routes_' not in text


def test_domain_packages_have_routes_and_boundaries() -> None:
    root = Path(__file__).parents[1] / 'app' / 'domains'
    for name in ('artifacts', 'datasets', 'projects', 'workflows', 'runs', 'nodes', 'auth'):
        assert (root / name / 'routes.py').exists()
    for name in ('artifacts', 'datasets', 'projects', 'workflows'):
        assert (root / name / 'service.py').exists()
