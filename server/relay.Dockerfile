FROM python:3.13-slim

ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1
WORKDIR /app/server
COPY serve.py relay.py relay_auth.py relay_admin.py ./
RUN mkdir /empty /data && chown 10001:10001 /data
USER 10001:10001
EXPOSE 8081
HEALTHCHECK --interval=15s --timeout=3s --start-period=5s CMD python3 -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8081/healthz', timeout=2).read()"
CMD ["python3", "serve.py", "--bind", "0.0.0.0", "--port", "8081", "--adhoc-ws", "--web-root", "/empty", "--wasm-root", "/empty"]
