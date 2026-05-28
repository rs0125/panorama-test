import Link from 'next/link';

// Horizontal, scrollable strip of every scene in the tour (in order) so the
// admin can hop straight to a sibling while editing — no round-trip back to the
// tour page. The current scene is marked active and isn't a link.
export default function SceneSwitcher({ scenes = [], currentId }) {
  if (scenes.length < 2) return null;

  return (
    <nav className="scene-switcher" aria-label="Scenes in this tour">
      <div className="scene-switcher__title">Scenes</div>
      <ul className="scene-switcher__list">
        {scenes.map((s, i) => {
          const active = s.id === currentId;
          const label = (
            <>
              <span className="scene-switcher__num">{i + 1}</span>
              <span className="scene-switcher__name">{s.title}</span>
            </>
          );
          return (
            <li
              key={s.id}
              className={`scene-switcher__item ${active ? 'scene-switcher__item--active' : ''}`}
            >
              {active ? (
                <span aria-current="page">{label}</span>
              ) : (
                <Link href={`/admin/scene/${s.id}`}>{label}</Link>
              )}
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
