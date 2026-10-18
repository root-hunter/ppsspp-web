.PHONY: wasm-ffmpeg help app-install app-build app-build-pages pages wasm-dev wasm-dev-local wasm-release wasm-release-local serve serve-local \
	server-docker-up server-docker-up-local server-docker-down server-docker-logs \
	wasm-status wasm-root-check wasm-submodules wasm-submodule-branch \
	wasm-submodule-update wasm-submodule-use-local wasm-submodule-use-origin \
	wasm-pin-local

APP_DIR := wasm-page
APP_DIST := $(APP_DIR)/dist/ppsspp-web
PAGES_WASM_BUILD ?= release
WASM_SUBMODULE := deps/ppsspp-wasm
LOCAL_WASM_ROOT ?= ../ppsspp-wasm
WASM_ROOT ?= $(WASM_SUBMODULE)
WASM_BRANCH ?= wasm
BIND ?= 192.168.1.170
PORT ?= 8081
CMAKE ?= $(or $(wildcard /usr/bin/cmake),cmake)
WASM_JOBS ?= -j4
WASM_FFMPEG_JOBS ?= 4
WASM_ENABLE_LTO ?= ON
WASM_FFMPEG_DIR := $(abspath $(WASM_ROOT)/build-ffmpeg-wasm/install)
ifeq ($(PAGES_WASM_BUILD),dev)
PAGES_WASM_DIR := $(WASM_ROOT)/build-wasm
else
PAGES_WASM_DIR := $(WASM_ROOT)/build-wasm-release
endif

help:
	@echo "PPSSPP web targets:"
	@echo "  make app-install           Install Angular app dependencies"
	@echo "  make app-build             Build the Angular app"
	@echo "  make app-build-pages       Build a static Pages app from an existing ppsspp-wasm build"
	@echo "  make pages                 Build ppsspp-wasm release, then build the static Pages app"
	@echo "  make wasm-dev              Build the active WASM_ROOT ($(WASM_ROOT)) for dev"
	@echo "  make wasm-release          Build the active WASM_ROOT ($(WASM_ROOT)) for release"
	@echo "  make serve                 Build the Angular app and serve the active WASM_ROOT ($(WASM_ROOT))"
	@echo "  make server-docker-up      Serve through Docker, mounting WASM_ROOT"
	@echo "  make wasm-status           Show web, submodule, and local clone status"
	@echo "  make wasm-submodule-branch Put the submodule on branch $(WASM_BRANCH) for local edits"
	@echo "  make wasm-submodule-update Move the submodule to origin/$(WASM_BRANCH)"
	@echo "  make wasm-pin-local        Point the submodule at LOCAL_WASM_ROOT HEAD"
	@echo ""
	@echo "Variables:"
	@echo "  WASM_ROOT=$(WASM_ROOT)"
	@echo "  LOCAL_WASM_ROOT=$(LOCAL_WASM_ROOT)"
	@echo "  WASM_BRANCH=$(WASM_BRANCH)"
	@echo "  PAGES_WASM_BUILD=$(PAGES_WASM_BUILD)"
	@echo "  WASM_ENABLE_LTO=$(WASM_ENABLE_LTO)"

app-install:
	npm --prefix $(APP_DIR) install

app-build:
	npm --prefix $(APP_DIR) run build

app-build-pages: wasm-root-check
	@grep -q '^USE_FFMPEG:BOOL=ON' "$(PAGES_WASM_DIR)/CMakeCache.txt" || (echo "Refusing to publish a build without FFmpeg. Run make wasm-release." >&2; exit 1)
	@test -f "$(PAGES_WASM_DIR)/PPSSPPSDL.js" || (echo "Missing $(PAGES_WASM_DIR)/PPSSPPSDL.js. Run: make wasm-release" >&2; exit 1)
	@test -f "$(PAGES_WASM_DIR)/PPSSPPSDL.wasm" || (echo "Missing $(PAGES_WASM_DIR)/PPSSPPSDL.wasm. Run: make wasm-release" >&2; exit 1)
	@test -f "$(PAGES_WASM_DIR)/PPSSPPSDL.data" || (echo "Missing $(PAGES_WASM_DIR)/PPSSPPSDL.data. Run: make wasm-release" >&2; exit 1)
	npm --prefix $(APP_DIR) run build:pages
	rm -rf "$(APP_DIST)/build-wasm" "$(APP_DIST)/build-wasm-release" "$(APP_DIST)/assets"
	mkdir -p "$(APP_DIST)/build-wasm"
	cp -aL "$(PAGES_WASM_DIR)/PPSSPPSDL.js" "$(APP_DIST)/build-wasm/"
	cp -aL "$(PAGES_WASM_DIR)/PPSSPPSDL.wasm" "$(APP_DIST)/build-wasm/"
	cp -aL "$(PAGES_WASM_DIR)/PPSSPPSDL.data" "$(APP_DIST)/build-wasm/"
	@if [ -d "$(WASM_ROOT)/assets" ]; then mkdir -p "$(APP_DIST)/build-wasm/assets"; cp -aL "$(WASM_ROOT)/assets/." "$(APP_DIST)/build-wasm/assets/"; find "$(WASM_ROOT)/assets" -type f ! -path '*/.*' | sed 's#^$(WASM_ROOT)/assets/##' | LC_ALL=C sort > "$(APP_DIST)/assets-manifest.txt"; fi
	python3 scripts/write-build-info.py "$(PAGES_WASM_DIR)" "$(APP_DIST)/build-info.json"
	@touch "$(APP_DIST)/.nojekyll"
	@test -f "$(APP_DIST)/index.html"
	@grep -q '<base href="./">' "$(APP_DIST)/index.html"
	@test -f "$(APP_DIST)/manifest.webmanifest"
	@test -f "$(APP_DIST)/sw.js"
	@test -f "$(APP_DIST)/ppsspp-runtime.js"
	@test -f "$(APP_DIST)/build-wasm/PPSSPPSDL.js"
	@test -f "$(APP_DIST)/build-wasm/PPSSPPSDL.wasm"
	@test -f "$(APP_DIST)/build-wasm/PPSSPPSDL.data"
	@test ! -e "$(APP_DIST)/build-wasm/CMakeCache.txt"
	@test ! -d "$(APP_DIST)/build-wasm/lib"
	@echo "GitHub Pages static bundle ready in $(APP_DIST) using $(PAGES_WASM_DIR)"

pages: wasm-release app-build-pages

wasm-root-check:
	@test -d "$(WASM_ROOT)" || (echo "Missing WASM_ROOT: $(WASM_ROOT)" >&2; exit 1)
	@test -f "$(WASM_ROOT)/Makefile" || (echo "WASM_ROOT does not look like ppsspp-wasm: $(WASM_ROOT)" >&2; exit 1)

wasm-ffmpeg: wasm-root-check
	WASM_FFMPEG_JOBS="$(WASM_FFMPEG_JOBS)" bash scripts/build-ffmpeg-wasm.sh "$(WASM_ROOT)"

wasm-dev:
	@if [ "$(abspath $(WASM_ROOT))" = "$(abspath $(WASM_SUBMODULE))" ]; then $(MAKE) wasm-submodules; fi
	$(MAKE) wasm-root-check WASM_ROOT="$(WASM_ROOT)"
	git config --global --add safe.directory "$(abspath $(WASM_ROOT))" || true
	$(MAKE) wasm-ffmpeg WASM_ROOT="$(WASM_ROOT)"
	$(MAKE) -C $(WASM_ROOT) wasm-dev-config CMAKE=$(CMAKE)
	emcmake $(CMAKE) -S "$(WASM_ROOT)" -B "$(WASM_ROOT)/build-wasm" -DUSE_FFMPEG=ON -DFFMPEG_DIR="$(WASM_FFMPEG_DIR)"
	$(MAKE) -C $(WASM_ROOT) wasm-dev-build CMAKE=$(CMAKE) WASM_JOBS="$(WASM_JOBS)"

wasm-dev-local:
	$(MAKE) wasm-dev WASM_ROOT="$(LOCAL_WASM_ROOT)"

wasm-release:
	@if [ "$(abspath $(WASM_ROOT))" = "$(abspath $(WASM_SUBMODULE))" ]; then $(MAKE) wasm-submodules; fi
	$(MAKE) wasm-root-check WASM_ROOT="$(WASM_ROOT)"
	git config --global --add safe.directory "$(abspath $(WASM_ROOT))" || true
	$(MAKE) wasm-ffmpeg WASM_ROOT="$(WASM_ROOT)"
	$(MAKE) -C $(WASM_ROOT) wasm-release-config CMAKE=$(CMAKE)
	emcmake $(CMAKE) -S "$(WASM_ROOT)" -B "$(WASM_ROOT)/build-wasm-release" -DWASM_ENABLE_LTO=$(WASM_ENABLE_LTO) -DUSE_FFMPEG=ON -DFFMPEG_DIR="$(WASM_FFMPEG_DIR)"
	$(MAKE) -C $(WASM_ROOT) wasm-release-build CMAKE=$(CMAKE) WASM_JOBS="$(WASM_JOBS)"
	rm -rf build-wasm-release assets
	ln -s $(WASM_ROOT)/build-wasm-release build-wasm-release
	mkdir -p assets
	cp -a $(WASM_ROOT)/assets/. assets/

wasm-release-local:
	$(MAKE) wasm-release WASM_ROOT="$(LOCAL_WASM_ROOT)"

serve: app-build wasm-root-check
	python3 server/serve.py --https --wasm-root $(WASM_ROOT) --bind $(BIND) --port $(PORT) --adhoc-ws

serve-local:
	$(MAKE) serve WASM_ROOT="$(LOCAL_WASM_ROOT)"

server-docker-up:
	WASM_ROOT="$(abspath $(WASM_ROOT))" docker compose up --build ppsspp-wasm-server

server-docker-up-local:
	$(MAKE) server-docker-up WASM_ROOT="$(LOCAL_WASM_ROOT)"

wasm-submodules:
	git submodule sync --recursive
	git submodule update --init --recursive

wasm-submodule-branch: wasm-submodules
	git -C $(WASM_SUBMODULE) switch $(WASM_BRANCH) || git -C $(WASM_SUBMODULE) switch -c $(WASM_BRANCH) --track origin/$(WASM_BRANCH)
	git -C $(WASM_SUBMODULE) submodule update --init --recursive

wasm-submodule-update:
	git submodule update --init --recursive --remote --merge $(WASM_SUBMODULE)
	git -C $(WASM_SUBMODULE) submodule update --init --recursive

wasm-submodule-use-local:
	@git -C "$(LOCAL_WASM_ROOT)" rev-parse --is-inside-work-tree >/dev/null 2>&1 || (echo "Missing LOCAL_WASM_ROOT Git checkout: $(LOCAL_WASM_ROOT)" >&2; exit 1)
	git config submodule.$(WASM_SUBMODULE).url "$(abspath $(LOCAL_WASM_ROOT))"
	git submodule update --init --recursive $(WASM_SUBMODULE)

wasm-submodule-use-origin:
	git config --unset submodule.$(WASM_SUBMODULE).url || true
	git submodule sync -- $(WASM_SUBMODULE)
	git submodule update --init --recursive $(WASM_SUBMODULE)

wasm-pin-local:
	@git -C "$(LOCAL_WASM_ROOT)" rev-parse --is-inside-work-tree >/dev/null 2>&1 || (echo "Missing LOCAL_WASM_ROOT Git checkout: $(LOCAL_WASM_ROOT)" >&2; exit 1)
	@if ! git -C "$(LOCAL_WASM_ROOT)" diff --quiet || ! git -C "$(LOCAL_WASM_ROOT)" diff --cached --quiet; then \
		echo "LOCAL_WASM_ROOT has uncommitted changes; commit them before pinning the submodule." >&2; \
		exit 1; \
	fi
	@branch=$$(git -C "$(LOCAL_WASM_ROOT)" branch --show-current); \
	commit=$$(git -C "$(LOCAL_WASM_ROOT)" rev-parse HEAD); \
	if [ -z "$$branch" ]; then \
		echo "LOCAL_WASM_ROOT is detached; switch to a branch before pinning." >&2; \
		exit 1; \
	fi; \
	git submodule update --init --recursive $(WASM_SUBMODULE); \
	git -C "$(WASM_SUBMODULE)" fetch "$(abspath $(LOCAL_WASM_ROOT))" "$$branch"; \
	git -C "$(WASM_SUBMODULE)" checkout "$$commit"; \
	echo "Pinned $(WASM_SUBMODULE) to $$commit from $(LOCAL_WASM_ROOT)."; \
	echo "Review with: git diff --submodule"

wasm-status:
	@echo "ppsspp-web:"
	@git status --short --branch
	@echo ""
	@echo "submodule pointer:"
	@git submodule status $(WASM_SUBMODULE)
	@echo ""
	@echo "$(WASM_SUBMODULE):"
	@if git -C "$(WASM_SUBMODULE)" rev-parse --is-inside-work-tree >/dev/null 2>&1; then \
		git -C "$(WASM_SUBMODULE)" status --short --branch; \
		git -C "$(WASM_SUBMODULE)" log -1 --oneline; \
	else \
		echo "not initialized"; \
	fi
	@echo ""
	@echo "$(LOCAL_WASM_ROOT):"
	@if git -C "$(LOCAL_WASM_ROOT)" rev-parse --is-inside-work-tree >/dev/null 2>&1; then \
		git -C "$(LOCAL_WASM_ROOT)" status --short --branch; \
		git -C "$(LOCAL_WASM_ROOT)" log -1 --oneline; \
	else \
		echo "not found"; \
	fi

server-docker-down:
	docker compose down

server-docker-logs:
	docker compose logs -f ppsspp-wasm-server
