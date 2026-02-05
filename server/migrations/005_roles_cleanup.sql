update users set role = 'family' where role is null or role not in ('admin','family');

