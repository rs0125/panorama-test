'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/apiClient.js';

export default function TourListAdmin({ initialTours }) {
  const router = useRouter();
  const [tours, setTours] = useState(initialTours);
  const [creating, setCreating] = useState(false);
  const [title, setTitle] = useState('');
  const [slug, setSlug] = useState('');
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const onCreate = async (e) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const tour = await api.createTour({ title, slug: slug || undefined });
      setTours((ts) => [...ts, { ...tour, _count: { scenes: 0 } }]);
      setTitle('');
      setSlug('');
      setCreating(false);
      router.push(`/admin/tour/${tour.id}`);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const onDelete = async (id) => {
    if (!confirm('Delete this tour and everything inside it? This cannot be undone.')) return;
    try {
      await api.deleteTour(id);
      setTours((ts) => ts.filter((t) => t.id !== id));
    } catch (err) {
      alert(err.message);
    }
  };

  return (
    <div className="admin__panel">
      <div className="admin__toolbar">
        <button
          type="button"
          className="btn btn--primary"
          onClick={() => setCreating((c) => !c)}
        >
          {creating ? 'Cancel' : '+ New tour'}
        </button>
      </div>

      {creating && (
        <form className="admin__form" onSubmit={onCreate}>
          <label className="field">
            <span className="field__label">Title</span>
            <input
              className="field__input"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Whitefield Warehouse"
              required
              autoFocus
            />
          </label>
          <label className="field">
            <span className="field__label">Slug (optional)</span>
            <input
              className="field__input"
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              placeholder="auto-generated from title"
            />
          </label>
          {error && <div className="admin__error">{error}</div>}
          <div className="admin__form-actions">
            <button type="submit" className="btn btn--primary" disabled={busy || !title}>
              {busy ? 'Creating…' : 'Create tour'}
            </button>
          </div>
        </form>
      )}

      {tours.length === 0 ? (
        <div className="admin__empty">No tours yet. Create one above.</div>
      ) : (
        <ul className="admin__list">
          {tours.map((t) => (
            <li key={t.id} className="admin__list-item">
              <div className="admin__list-main">
                <Link href={`/admin/tour/${t.id}`} className="admin__list-title">
                  {t.title}
                </Link>
                <div className="admin__list-meta">
                  /{t.slug} · {t._count?.scenes ?? 0} scenes
                </div>
              </div>
              <div className="admin__list-actions">
                <Link href={`/tour/${t.slug}`} className="btn btn--ghost" target="_blank">
                  View
                </Link>
                <Link href={`/admin/tour/${t.id}`} className="btn btn--ghost">
                  Edit
                </Link>
                <button
                  type="button"
                  className="btn btn--ghost btn--danger"
                  onClick={() => onDelete(t.id)}
                >
                  Delete
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
