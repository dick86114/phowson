export const buildUserJsonSql = (alias) => {
  return `
    json_build_object(
      'id', ${alias}.id,
      'name', ${alias}.name,
      'avatar', coalesce(${alias}.avatar_url, '/media/avatars/' || ${alias}.id),
      'role', ${alias}.role
    )
  `;
};

export const photoSelectSql = (withLikes) => {
  const likesSql = withLikes
    ? `
        , coalesce(l.likes, '[]'::json) as likes
      `
    : `, '[]'::json as likes`;

  const likesJoin = withLikes
    ? `
      left join lateral (
        select json_agg(json_build_object('userId', coalesce(pl.user_id, pl.guest_id))) as likes
        from photo_likes pl
        where pl.photo_id = p.id
      ) l on true
    `
    : '';

  return `
    select
      p.id,
      '/media/photos/' || p.id as url,
      nullif(p.image_variants->>'thumb', '') as "thumbUrl",
      nullif(p.image_variants->>'medium', '') as "mediumUrl",
      nullif(p.image_url, '') as "originalUrl",
      p.title,
      p.description,
      p.category,
      array_to_string(p.tags, ',') as tags,
      p.exif::text as exif,
      p.created_at as "createdAt",
      p.updated_at as "updatedAt",
      p.views_count as "viewsCount",
      p.likes_count as "likesCount",
      p.ai_critique as "aiCritique",
      p.image_width as "imageWidth",
      p.image_height as "imageHeight",
      p.image_size_bytes::int as "imageSizeBytes",
      p.lat,
      p.lng,
      ${buildUserJsonSql('u')} as "user",
      coalesce(c.comments, '[]'::json) as comments
      ${likesSql}
    from photos p
    left join users u on u.id = p.owner_user_id
    left join lateral (
      select json_agg(
        json_build_object(
          'id', pc.id,
          'content', pc.content,
          'createdAt', pc.created_at,
          'userId', coalesce(pc.user_id, 'guest'),
          'user', case 
            when pc.user_id is not null then ${buildUserJsonSql('cu')}
            else json_build_object(
              'id', 'guest',
              'name', coalesce(pc.guest_nickname, '游客'),
              'avatar', 'https://ui-avatars.com/api/?name=' || coalesce(pc.guest_nickname, 'Guest') || '&background=random',
              'role', 'guest'
            )
          end
        )
        order by pc.created_at asc
      ) as comments
      from photo_comments pc
      left join users cu on cu.id = pc.user_id
      where pc.photo_id = p.id
    ) c on true
    ${likesJoin}
  `;
};
