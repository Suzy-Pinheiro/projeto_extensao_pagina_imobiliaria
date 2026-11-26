# Página · Imóveis

Landing page imobiliária de uso mobile-first, com vitrine dinâmica, formulários de contato pelo WhatsApp e uma área administrativa para cadastrar imóveis e gerenciar fotos.

## Observação sobre a entrega

O projeto completo está publicado no GitHub em: https://github.com/Suzy-Pinheiro/projeto_extensao_pagina_imobiliaria

Não foi possível incluir todos os arquivos e detalhes técnicos do desenvolvimento no relatório em PDF. Para consultar o código-fonte, o esquema do banco de dados, as configurações e as instruções completas de execução e publicação, utilize o repositório do projeto indicado acima.

## Funcionalidades

- Página pública com apresentação da corretora e formulários de captação para clientes e proprietários.
- Vitrine conectada ao Supabase, com filtros de compra e aluguel, preço em reais e contato via WhatsApp.
- Galeria em carrossel nos cartões; toque na foto abre uma visualização ampliada.
- Painel administrativo em `admin.html`, protegido por autenticação do Supabase.
- Cadastro e edição de imóveis, seleção de status e gerenciamento de até 15 imagens por imóvel.
- Imóveis publicados e disponíveis aparecem publicamente. Registros alugados, vendidos, em rascunho ou não publicados ficam fora da vitrine.

## Estrutura

```text
.
├── index.html                 # Landing page pública
├── admin.html                 # Login e painel de gerenciamento
├── assets/
│   └── joice-motta.png        # Foto de perfil
├── css/
│   └── style.css              # Estilos adicionais e componentes da galeria
├── js/
│   ├── app.js                 # Vitrine, filtros e formulários de WhatsApp
│   ├── admin.js               # Autenticação e gerenciamento de imóveis/fotos
│   └── supabase-config.js     # URL do projeto e chave publicável
└── supabase/
    └── schema.sql             # Esquema inicial, políticas e dados demonstrativos
```

## Tecnologias

- HTML5 semântico
- Tailwind CSS via CDN e CSS adicional
- JavaScript ES modules
- Supabase: PostgreSQL, Auth, Row Level Security (RLS) e Storage
- Google Fonts e imagens demonstrativas do Unsplash

Não há etapa de build. O JavaScript importa o cliente Supabase de `esm.sh`, então a página precisa de conexão à internet. Sirva os arquivos por HTTP/HTTPS; abrir o HTML diretamente com `file://` pode impedir módulos e requisições ao Supabase.

## Configuração do Supabase

1. Crie um projeto no [Supabase](https://supabase.com/).
2. No **SQL Editor** do projeto, execute `supabase/schema.sql` para configurar as tabelas `properties` e `property_images`, políticas RLS, o bucket privado de imagens e quatro anúncios de demonstração.

   - O script é destinado à configuração inicial de um projeto novo.
   - Se já houver uma versão anterior do esquema, não execute o script novamente sem antes preparar uma migração.
3. Em **Authentication**, desative o cadastro público e crie a conta da corretora.
4. Autorize a conta da corretora com a claim confiável `app_metadata.role = "admin"` no Supabase. Não use `user_metadata` nem código do navegador para atribuir esse papel. Depois de alterar a claim, encerre e inicie a sessão novamente.
5. Em **Project Settings → API** (ou **Connect**), obtenha a Project URL e a chave **Publishable** ou **anon**.
6. Preencha `SUPABASE_URL` e `SUPABASE_ANON_KEY` em `js/supabase-config.js`:

   ```js
   export const SUPABASE_URL = "https://SEU-PROJETO.supabase.co";
   export const SUPABASE_ANON_KEY = "SUA_CHAVE_PUBLICAVEL";
   ```

### Segurança

- A URL e a chave Publishable/anon são valores do frontend e podem ser inspecionadas no navegador. A proteção dos dados depende das políticas RLS e de Storage criadas pelo esquema.
- `supabase/schema.sql` contém a estrutura do banco, as políticas de acesso e anúncios demonstrativos, mas não credenciais; pode ser compartilhado. Antes de publicar, revise os dados demonstrativos e substitua qualquer informação que não deva ficar pública.
- **Nunca coloque `service_role`, chaves secretas, senhas ou tokens administrativos em arquivos do site ou no repositório.** A `service_role` ignora as políticas RLS.
- Mantenha desativado o cadastro público e proteja o acesso à conta Supabase e ao repositório GitHub.
- Dados de anúncios publicados e disponíveis, inclusive suas fotos, são públicos por definição. Links assinados de imagens privadas expiram após cinco minutos; isso não apaga cópias que visitantes tenham baixado enquanto o anúncio estava disponível.
- As verificações do painel no JavaScript são para a experiência de uso; as políticas RLS no Supabase são a barreira de autorização efetiva.

## Executar localmente

No PowerShell, na pasta do projeto:

```powershell
python -m http.server 8000
```

Abra `http://localhost:8000`. O painel administrativo está em `http://localhost:8000/admin.html`.

## Usar o painel administrativo

1. Abra `admin.html` e entre com a conta autorizada no Supabase.
2. Escolha **Novo imóvel** para cadastrar um anúncio ou **Editar** para atualizar um existente.
3. Selecione uma ou mais imagens JPEG, PNG ou WebP, cada uma com até 10 MB. O limite é de 15 imagens por imóvel.
4. Defina se o imóvel está em rascunho, disponível, alugado ou vendido e marque a publicação apenas quando quiser exibi-lo na vitrine.
5. Salve. Para retirar um anúncio da vitrine sem apagar seu histórico, altere o status ou desmarque a publicação.

## Publicar no GitHub Pages

1. Envie o projeto ao repositório, mantendo `index.html` na raiz e incluindo `admin.html`, `assets/`, `css/`, `js/` e `supabase/`.
2. No GitHub, abra **Settings → Pages**, selecione **Deploy from a branch**, escolha a branch e a pasta `/ (root)` e salve.
3. Em **Supabase → Authentication → URL Configuration**, configure o endereço do site publicado como **Site URL** e adicione o endereço de `admin.html` às **Redirect URLs** permitidas. Se usar domínio próprio, configure o domínio final.
4. Após a publicação, teste a vitrine, o login administrativo, o envio de imagens e a alteração de status usando o domínio HTTPS do site.

Como o site é estático, não configure a chave `service_role` como variável de frontend no GitHub Pages. Restrinja colaboradores do repositório e proteja a branch usada na publicação.
