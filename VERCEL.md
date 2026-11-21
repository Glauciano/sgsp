# Deploy no Vercel - S.G.S.P

## 1. Subir para Github (já feito)
https://github.com/Glauciano/sgsp

## 2. Import no Vercel
1. Acesse vercel.com -> Add New -> Project -> Import `Glauciano/sgsp`
2. Framework: Vite (detectado automaticamente)
3. Build Command: `npm run build` | Output: `dist`
4. Environment Variables -> Add `DATABASE_URL` = sua connection string Supabase (Transaction pooler 6543)
5. Deploy

## URLs depois:
- Frontend: https://sgsp.vercel.app
- API: https://sgsp.vercel.app/api/matriz-distancias/recalcular

## 3. Banco Supabase
1. supabase.com -> SQL Editor -> cole `database.sql` -> Run
2. Database -> Connect -> Transaction pooler -> copie String
3. Cole no Vercel ENV

Pronto: cada `git push` faz deploy automático.
