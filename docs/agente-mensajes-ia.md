# Agente de mensajes con IA

La app tiene una funcion Firebase HTTPS llamada `organizarMensajes`.

## Requisito

Configurar el secreto de OpenAI en Firebase:

```bash
firebase functions:secrets:set OPENAI_API_KEY
```

Pega la API key cuando Firebase la pida.

## Despliegue

```bash
firebase deploy --only functions,hosting
```

## Funcionamiento

La pantalla `Mensajes` envia el texto a `/api/organizar-mensajes`.
La funcion llama a OpenAI con `gpt-5-mini` y devuelve JSON con:

- `grupo`
- `caja`
- `taller`
- `redes`
- `dudas`

Si la funcion no responde, la pantalla conserva el organizador local como respaldo.
