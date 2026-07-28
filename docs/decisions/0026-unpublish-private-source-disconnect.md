# ADR 0026: Automatic unpublish after private-source disconnect

When a private source is disconnected or becomes unavailable, CommitTrail cannot continue supporting its disclosure safely. It immediately removes public access, records a private event where lifecycle retention permits, and invalidates project, profile, and sitemap caches.
