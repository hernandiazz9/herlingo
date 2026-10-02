# Instalar `hybrid`

La skill que explica cómo trabajás un plan entre la nube (claude.ai/code) y tu Mac: arranque
barato, nombres de sesión, avance continuo, reviews que no frenan nada, handoffs en los dos
sentidos y cuidado de tokens. Este archivo es para vos y queda fuera de la skill (la skill va en
inglés y se empaqueta entera).

## 1. En la Mac (copia maestra)

```bash
unzip -o hybrid.skill -d ~/.claude/skills/     # o: cp -R hybrid ~/.claude/skills/
ls ~/.claude/skills/hybrid/SKILL.md
```

Abrí una sesión nueva y probá `/hybrid`. Lo que está en `~/.claude/skills` carga en todos tus
proyectos de esa máquina (verificado en la doc). Te conviene versionar esa carpeta con git: es
la copia maestra.

## 2. En la nube

Lo de `~/.claude/skills` de tu Mac **no llega** a las sesiones en la nube (verificado). Dos
caminos:

**A. Subirla a tu cuenta de claude.ai (recomendado).**
- Si en el chat te aparece el botón "Save skill" sobre `hybrid.skill`, tocalo. Si no, subí el
  zip en la sección Skills de la configuración de claude.ai (verify el nombre exacto del menú)
  y activala.
- Según la doc, las skills de tu cuenta cargan en la nube y también en la app de escritorio y en
  la terminal con `/login`. La sincronización tarda hasta ~10 min.
- Sin probar: que una skill subida por vos aparezca en la nube (acá sólo había skills de
  Anthropic). Probalo: sesión nueva en la nube → `/hybrid`, o pedile a Claude
  `ls ~/.claude/skills/synced/*/`.
- En la Mac vas a tener dos copias: `/hybrid` usa la local y la de la cuenta queda como
  `/anthropic-skills:hybrid` (su descripción aparece dos veces, un costo chico). Después de cada
  cambio, volvé a subir el zip; la línea `Version:` de SKILL.md te dice qué copia cargó.

**B. Plan B por repo.** Las sesiones en la nube cargan `.claude/skills/` del repo: copiá la
carpeta a `<repo>/.claude/skills/hybrid/`, commit y push. Contra: una copia por proyecto.

## 3. Una línea en el CLAUDE.md de cada proyecto (respaldo)

```
Multi-task plans in plans/ follow the hybrid skill: on resume read the plan's ## Now block first.
```

Así un "seguí" corto funciona aunque la skill no se active sola.

## 4. Una vez por repo (Claude te lo propone, vos aprobás)

- `.claude/settings.json` con `{"worktree": {"baseRef": "head"}}`: sin esto los agentes en la
  nube arrancan desde main en vez de tu rama.
- `.gitignore` con `.claude/worktrees/` y `.env*` (más `!.env.example`).
- Lint, typecheck y tests excluyen `.claude/` (ahí viven los worktrees de los agentes).
- Opcional: un hook de SessionStart que instale dependencias en la nube.

## 5. Claves en la nube (una vez)

Sesión en la nube → menú del entorno en la barra de título → Edit → Environment variables:
líneas `NOMBRE=valor`. Las toman las sesiones nuevas (o la misma cuando reinicia la VM). Ojo: las
ve cualquiera que use ese entorno. Para APIs de terceros, si tu plan es Pro/Max, existe "API
credentials" (la clave nunca entra a la VM); no sirve para api.anthropic.com: para eso usá una
clave aparte con límite bajo como variable. Nunca pegues claves en el chat.

## 6. Cómo leer los títulos

- 🟢 = la sesión que seguís para ese plan (el puntito de estado de la app te dice si está
  trabajando ahora) · ✋ = te necesita (clave, decisión, aprobación, límite)
- 🔍 = pasada de review en la Mac, no escribe el plan · ✅ = terminada · ❌ = vieja: el trabajo
  siguió donde marca la flecha
- ☁️ nube, 💻 Mac. `☁️→💻` = esta sesión pasó el trabajo a la Mac; `💻←☁️` = esta lo tomó de la nube
- El rango: `T42–` todavía sigue; `T42–T45` es lo que hizo esa sesión
- Regla: por plan hay una sola 🟢 o ✋. Esa es la que seguís; buscá `P005` en la lista
- La primera vez que una sesión en la nube se renombre, mirá que ☁️ se vea bien; si no, avisá y
  pasamos a ⛅

## Cómo se usa

- "seguí con el plan", "retomá P007", `/hybrid`: arranque barato desde el bloque Now.
- "me paso a la compu", "dejá todo listo para la nube": handoff con los comandos exactos.
- "qué sesión sigo?": te dice cuál y cómo abrirla.
- "revisá lo que hizo la nube" (en la Mac): pasada 🔍; los hallazgos vuelven como tareas de fix
  sin frenar a la nube.
- Para que tus sesiones de la Mac aparezcan también en claude.ai y el celular, arrancalas con
  `claude --remote-control "<título>"`.
