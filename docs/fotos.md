# Padronização de fotos

Como o MOVIX recebe, normaliza, armazena e exibe imagens. Decisões em
[`planejamento/DECISIONS.md`](planejamento/DECISIONS.md) (D-027 a D-030).

## 1. Relatório de problemas (estado anterior, commit `6e01134`)

| # | Severidade | Local | Problema | Situação |
|---|---|---|---|---|
| 1 | Alta | `next.config.ts:41` × `vehicle-form.tsx:66`, `inspection-form.tsx`, `operations/forms.tsx:88` | `bodySizeLimit` das Server Actions é 12 MB, mas o cadastro aceitava 10 × 5 MB, a vistoria 11 × 8 MB e as ocorrências 6 × 5 MB. Envios grandes falhavam com erro genérico. | Corrigido: compressão no cliente (≈ 0,1–0,5 MB por foto) e aviso quando o total passa de 11 MB. |
| 2 | Alta | `inspections/actions.ts:22,27` × `storage.sql:12` | Vistoria validava até 8 MB, mas o bucket `inspection-media` aceita 5 MB: o storage recusava depois da vistoria criada. | Corrigido: servidor valida 5 MB (limite real); cliente aceita 8 MB **antes** da compressão. |
| 3 | Alta (privacidade) | todo o fluxo de upload | Fotos de celular iam com EXIF, incluindo **GPS** e modelo do aparelho, e eram visíveis a locatários vinculados. | Corrigido: a recodificação em canvas remove todos os metadados. |
| 4 | Média | `vehicle-widgets.tsx:16`, `file-field.tsx:43`, `frota/page.tsx:112` | Proporções diferentes em cada lugar (miniatura quadrada no campo, 4:3 na galeria, 16:9 na lista) e nenhum padrão no arquivo salvo. | Corrigido: arquivo salvo em 4:3 e moldura `PhotoFrame` 4:3 em todo lugar. |
| 5 | Média | `fleet/actions.ts:15` | `files.slice(0, 10)` descartava fotos excedentes em silêncio. | Corrigido: o envio é recusado com mensagem; o campo limita a seleção. |
| 6 | Média | `fleet/actions.ts:92-93` | Posição = quantidade de fotos: depois de uma exclusão, as posições se repetiam e a capa ficava indefinida. Limite de 12 sujeito a corrida. | Corrigido: posição = maior + 1; trigger `vehicle_media_limit` no banco. |
| 7 | Média | `fleet/actions.ts:17` | Se a linha em `vehicle_media` falhasse, o arquivo ficava órfão no storage. | Corrigido: o objeto é removido em caso de falha. |
| 8 | Média | `fleet/actions.ts:35` | Falha nas fotos após criar o veículo devolvia erro; reenviar tentava cadastrar de novo (placa duplicada). | Corrigido: cadastro conclui com aviso e redireciona para a página do veículo. |
| 9 | Média | `fleet/actions.ts:106-107` | Exclusão removia o arquivo antes da linha: falha na linha deixava registro apontando para imagem inexistente. | Corrigido: linha primeiro (RLS confirma), depois o objeto. |
| 10 | Média (segurança) | `storage.ts:13` | Validação confiava no MIME declarado pelo navegador. | Corrigido: `validateImage` confere a assinatura real dos bytes e as dimensões. |
| 11 | Baixa | `file-field.tsx:69` | URLs `blob:` nunca eram revogadas (vazamento de memória a cada seleção). | Corrigido. |
| 12 | Baixa | `file-field.tsx:67` | Só checava tamanho; nova seleção substituía a anterior; sem remoção individual nem contador. | Corrigido: acumula, remove, conta e aceita arrastar e soltar. |
| 13 | Baixa | `vehicle-widgets.tsx` | Sem skeleton, contador, indicação de capa ou estado vazio. | Corrigido. |
| 14 | Baixa (desempenho) | `fleet/queries.ts:57` | `coverPhotos` lê todas as fotos de todos os veículos para escolher a primeira. | Mantido; ver "Próximos passos". |
| 15 | Baixa | `frota/[id]/page.tsx:31` | URLs assinadas expiram em 10 min; com a página aberta por mais tempo, as imagens quebram. | Mantido; o skeleton evita área vazia. Ver "Próximos passos". |

## 2. Especificação

| | Fotos de veículo (`VEHICLE_PHOTO`) | Vistoria (`EVIDENCE_PHOTO`) | Anexo de ocorrência (`ATTACHMENT_PHOTO`) |
|---|---|---|---|
| Recorte | 4:3 centralizado | **nenhum** (não cortar avarias) | nenhum |
| Tamanho máximo de saída | 1600 × 1200 | lado maior 1600 | lado maior 1600 |
| Formato | WebP 82%, ou JPEG 82% se o navegador não gerar WebP | igual | igual (PDF passa sem alteração) |
| Entrada máxima (antes da compressão) | 5 MB | 8 MB | 5 MB |
| Mínimo do arquivo final | 640 × 480 | 480 × 480 | sem mínimo |
| Quantidade | 10 no cadastro, 12 por veículo | 5 obrigatórias + 6 extras | 6 |
| Exibição | `PhotoFrame` 4:3 | miniatura `PhotoFrame` 4:3; clique abre a foto inteira | lista de anexos |

Arquivo no storage (bucket privado `vehicle-media`):
`{organization_id}/{vehicle_id}/{timestamp}-{nome-original}.{webp|jpg}`. O nome original é normalizado: minúsculas,
sem acentos, só `a-z0-9-`, até 40 caracteres. O prefixo da locadora é **obrigatório**, porque as policies de storage
autorizam pelo primeiro segmento. Fotos antigas, com nome UUID, continuam válidas: a exibição usa `storage_path` do banco.

### Fluxo cliente → servidor

```
Seleção / arrastar e soltar (FileField)
  → filtro de tipo (accept), tamanho de entrada e quantidade (maxFiles)
  → normalizeImageFile (src/lib/image.ts), uma foto por vez:
      assinatura real (JPEG/PNG/WebP)
      → decodificação com orientação EXIF (createImageBitmap "from-image"; aplicação manual se o navegador ignorar)
      → recorte centralizado 4:3 (resizeToAspect) + redução sem ampliar
      → dimensões mínimas
      → WebP 82%, ou JPEG (compressImage) — sem metadados
  → prévia 4:3 com a imagem já processada; o input recebe os arquivos otimizados (DataTransfer)
  → envio bloqueado enquanto houver imagem processando (useFormBusy); aviso se o total passar de 11 MB
Server Action
  → quantidade (10 no cadastro / restante até 12)
  → validateImage (src/lib/storage.ts): MIME permitido, ≤ 5 MB, assinatura == MIME, dimensões mínimas
  → upload (sessão do usuário, RLS do storage) → insert em vehicle_media (RLS + trigger de limite)
  → em falha: remove o objeto enviado
```

O servidor **não** exige proporção 4:3: se o processamento no cliente falhar (navegador antigo, formato que o canvas
não decodifica), o original passa pela validação e a moldura 4:3 garante a exibição uniforme.

## 3. Guia para o time

**Novo campo de upload de foto**

```tsx
import { FileField } from "@/components/ui/file-field";
import { VEHICLE_PHOTO } from "@/lib/image";

<FileField name="photos" label="Fotos" multiple maxFiles={10} normalize={VEHICLE_PHOTO} accept="image/jpeg,image/png,image/webp" />
```

- Sem `normalize`, o campo se comporta como antes (documentos, logo). Não use `normalize` em CNH/comprovantes: a
  compressão pode prejudicar a leitura.
- Dentro de `ActionForm`, o `SubmitButton` fica desabilitado ("Otimizando imagens…") enquanto houver processamento.

**Exibir uma foto**

```tsx
import { PhotoFrame } from "@/components/ui/photo-frame";

<PhotoFrame src={url} alt="Foto do veículo" />            {/* 4:3, object-cover, skeleton */}
<PhotoFrame src={url} alt="…">{overlay}</PhotoFrame>      {/* selos/botões sobrepostos */}
```

**Validar no servidor**: sempre use `validateImage`/`validateImages` com a mesma especificação do cliente. Nunca confie
só em `file.type`.

**Nova especificação**: crie um `ImageSpec` em `src/lib/image.ts` e cubra os casos em `tests/unit/image.test.ts`.

**Exceção intencional**: o cartão do veículo no app do locatário (`rental-hero.tsx`) é um banner 16:9, não uma
miniatura. Ele recorta a foto 4:3 com `object-cover`.

## 4. Checklist de aceitação

- [ ] Fotos 9:16, 16:9, 1:1 e 4:3 aparecem com o mesmo tamanho na galeria, na lista da frota e nas prévias do formulário.
- [ ] Foto de celular em retrato não aparece deitada (EXIF aplicado).
- [ ] Arquivo salvo é `.webp`, ou `.jpg` em navegador sem WebP, com no máximo 1600×1200 e sem EXIF/GPS.
- [ ] Foto menor que 640×480 (após o recorte) é recusada com a mensagem "Imagem muito pequena…".
- [ ] Arquivo acima de 5 MB (veículo) ou 8 MB (vistoria) é recusado antes do envio.
- [ ] Cadastro: no máximo 10 fotos; contador "n de 10"; excedentes não entram e geram aviso.
- [ ] Galeria: contador "n/12", selo "Capa" na primeira, formulário some ao atingir 12.
- [ ] Remover foto na prévia tira o arquivo do envio; enviar com sucesso limpa a prévia.
- [ ] Botão de envio desabilitado com "Otimizando imagens…" durante o processamento.
- [ ] Vistoria: foto não é cortada (abrir a foto mostra a imagem inteira); miniaturas em 4:3.
- [ ] PNG renomeado para `.jpg`, ou texto renomeado para `.webp`, é recusado pelo servidor.
- [ ] Fotos já existentes (nome UUID) continuam aparecendo e podem ser removidas.
- [ ] Dois envios simultâneos não ultrapassam 12 fotos (trigger).
- [ ] `npm run check` e `npm run test:e2e` passam.

## 5. Próximos passos sugeridos

- `coverPhotos`: buscar só a primeira foto por veículo (`distinct on (vehicle_id)` numa view ou RPC).
- URLs assinadas: renovar no cliente ao expirar, ou aumentar a validade só para miniaturas.
- Vistoria: hoje o registro é criado antes do upload das fotos (mensagem de falha parcial). Uma RPC que confirme a
  vistoria só depois das fotos tornaria o fluxo atômico.
- Variantes de miniatura (ex.: 480×360) para a lista da frota, reduzindo o tráfego no celular.
