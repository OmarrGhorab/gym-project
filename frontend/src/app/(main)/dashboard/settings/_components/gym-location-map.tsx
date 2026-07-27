"use client";

import * as React from "react";

import { Crosshair, LocateFixed, MapPin } from "lucide-react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

const DEFAULT_CENTER: [number, number] = [30.0444, 31.2357]; // Cairo
const DEFAULT_ZOOM = 15;
const MIN_RADIUS = 20;
const MAX_RADIUS = 2000;

type LeafletModule = typeof import("leaflet");
type LeafletMap = import("leaflet").Map;
type LeafletMarker = import("leaflet").Marker;
type LeafletCircle = import("leaflet").Circle;
type LeafletDivIcon = import("leaflet").DivIcon;

type GymLocationMapProps = {
  latitude: number | null;
  longitude: number | null;
  radiusMeters: number;
  className?: string;
};

function clampRadius(value: number) {
  if (!Number.isFinite(value)) {
    return 150;
  }

  return Math.min(MAX_RADIUS, Math.max(MIN_RADIUS, Math.round(value)));
}

function createPinIcon(L: LeafletModule) {
  return L.divIcon({
    className: "gym-map-pin",
    html: `<span style="
      display:block;
      width:16px;
      height:16px;
      border-radius:9999px;
      background:#0f766e;
      border:3px solid #fff;
      box-shadow:0 1px 6px rgba(15,23,42,.35);
    "></span>`,
    iconSize: [16, 16],
    iconAnchor: [8, 8],
  });
}

function refreshMapSize(map: LeafletMap) {
  map.invalidateSize({ animate: false });
}

export function GymLocationMap({ latitude, longitude, radiusMeters, className }: GymLocationMapProps) {
  const t = useTranslations("Dashboard.settings");
  const mapContainerRef = React.useRef<HTMLDivElement | null>(null);
  const mapShellRef = React.useRef<HTMLDivElement | null>(null);
  const mapRef = React.useRef<LeafletMap | null>(null);
  const markerRef = React.useRef<LeafletMarker | null>(null);
  const circleRef = React.useRef<LeafletCircle | null>(null);
  const pinIconRef = React.useRef<LeafletDivIcon | null>(null);
  const leafletRef = React.useRef<LeafletModule | null>(null);
  const initialPropsRef = React.useRef({ latitude, longitude, radiusMeters });
  const [mapReady, setMapReady] = React.useState(false);

  const initialLatitude = initialPropsRef.current.latitude;
  const initialLongitude = initialPropsRef.current.longitude;
  const initialRadius = initialPropsRef.current.radiusMeters;
  const hasInitialPoint =
    initialLatitude !== null &&
    initialLongitude !== null &&
    Number.isFinite(initialLatitude) &&
    Number.isFinite(initialLongitude);

  const [lat, setLat] = React.useState(hasInitialPoint ? Number(initialLatitude).toFixed(6) : "");
  const [lng, setLng] = React.useState(hasInitialPoint ? Number(initialLongitude).toFixed(6) : "");
  const [radius, setRadius] = React.useState(String(clampRadius(initialRadius || 150)));
  const [status, setStatus] = React.useState<string | null>(null);

  const latNumber = Number(lat);
  const lngNumber = Number(lng);
  const radiusNumber = clampRadius(Number(radius));
  const hasPoint = Number.isFinite(latNumber) && Number.isFinite(lngNumber);

  const drawPoint = React.useCallback((nextLat: number, nextLng: number, nextRadius: number, fly = false) => {
    const L = leafletRef.current;
    const map = mapRef.current;
    if (!L || !map) {
      return;
    }

    pinIconRef.current ??= createPinIcon(L);

    if (!markerRef.current) {
      markerRef.current = L.marker([nextLat, nextLng], {
        draggable: true,
        icon: pinIconRef.current,
      }).addTo(map);

      markerRef.current.on("dragend", () => {
        const position = markerRef.current?.getLatLng();
        if (!position) {
          return;
        }
        setLat(position.lat.toFixed(6));
        setLng(position.lng.toFixed(6));
      });
    } else {
      markerRef.current.setLatLng([nextLat, nextLng]);
    }

    if (!circleRef.current) {
      circleRef.current = L.circle([nextLat, nextLng], {
        radius: nextRadius,
        color: "#0f766e",
        fillColor: "#14b8a6",
        fillOpacity: 0.18,
        weight: 2,
      }).addTo(map);
    } else {
      circleRef.current.setLatLng([nextLat, nextLng]);
      circleRef.current.setRadius(nextRadius);
    }

    if (fly) {
      map.flyTo([nextLat, nextLng], Math.max(map.getZoom(), DEFAULT_ZOOM), { duration: 0.45 });
    } else {
      refreshMapSize(map);
    }
  }, []);

  React.useEffect(() => {
    const container = mapContainerRef.current;
    if (!container || mapRef.current) {
      return;
    }

    let cancelled = false;
    const timers: number[] = [];
    let resizeObserver: ResizeObserver | null = null;

    async function setupMap() {
      const leaflet = await import("leaflet");

      if (cancelled || !mapContainerRef.current || mapRef.current) {
        return;
      }

      const L = leaflet.default ?? leaflet;
      leafletRef.current = L;

      const startLat = initialPropsRef.current.latitude;
      const startLng = initialPropsRef.current.longitude;
      const startRadius = clampRadius(initialPropsRef.current.radiusMeters || 150);
      const hasStart = startLat !== null && startLng !== null && Number.isFinite(startLat) && Number.isFinite(startLng);
      const start: [number, number] = hasStart ? [startLat, startLng] : DEFAULT_CENTER;

      const map = L.map(mapContainerRef.current, {
        center: start,
        zoom: DEFAULT_ZOOM,
        scrollWheelZoom: true,
        // Prefer full tile coverage after layout settles in dashboard cards.
        preferCanvas: false,
      });

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        // Avoid half-loaded gray squares when container size changes.
        updateWhenIdle: false,
        updateWhenZooming: true,
        keepBuffer: 2,
      }).addTo(map);

      map.on("click", (event) => {
        setLat(event.latlng.lat.toFixed(6));
        setLng(event.latlng.lng.toFixed(6));
        setStatus(null);
      });

      mapRef.current = map;
      setMapReady(true);

      if (hasStart) {
        drawPoint(startLat, startLng, startRadius, false);
      }

      // Card/sidebar layout often settles after first paint — refresh a few times.
      for (const delay of [0, 50, 150, 350, 700]) {
        timers.push(
          window.setTimeout(() => {
            if (!cancelled && mapRef.current) {
              refreshMapSize(mapRef.current);
            }
          }, delay),
        );
      }

      const shell = mapShellRef.current;
      if (shell && typeof ResizeObserver !== "undefined") {
        resizeObserver = new ResizeObserver(() => {
          if (mapRef.current) {
            refreshMapSize(mapRef.current);
          }
        });
        resizeObserver.observe(shell);
      }

      window.addEventListener("resize", handleWindowResize);
    }

    function handleWindowResize() {
      if (mapRef.current) {
        refreshMapSize(mapRef.current);
      }
    }

    void setupMap();

    return () => {
      cancelled = true;
      for (const timer of timers) {
        window.clearTimeout(timer);
      }
      resizeObserver?.disconnect();
      window.removeEventListener("resize", handleWindowResize);
      mapRef.current?.remove();
      mapRef.current = null;
      markerRef.current = null;
      circleRef.current = null;
      leafletRef.current = null;
      setMapReady(false);
    };
  }, [drawPoint]);

  React.useEffect(() => {
    if (!mapReady || !hasPoint) {
      return;
    }
    drawPoint(latNumber, lngNumber, radiusNumber, false);
  }, [drawPoint, hasPoint, latNumber, lngNumber, mapReady, radiusNumber]);

  function useMyLocation() {
    if (!navigator.geolocation) {
      setStatus(t("mapGeolocationUnsupported"));
      return;
    }

    setStatus(t("mapLocating"));
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const nextLat = position.coords.latitude;
        const nextLng = position.coords.longitude;
        setLat(nextLat.toFixed(6));
        setLng(nextLng.toFixed(6));
        drawPoint(nextLat, nextLng, radiusNumber, true);
        setStatus(t("mapLocationApplied"));
      },
      () => {
        setStatus(t("mapGeolocationDenied"));
      },
      { enableHighAccuracy: true, timeout: 12000 },
    );
  }

  function applyManualCoordinates() {
    if (!hasPoint) {
      setStatus(t("mapInvalidCoordinates"));
      return;
    }
    drawPoint(latNumber, lngNumber, radiusNumber, true);
    setStatus(null);
  }

  return (
    <div className={cn("gym-location-map grid gap-3", className)}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-muted-foreground text-xs">{t("mapHint")}</p>
        <Button type="button" size="sm" variant="outline" onClick={useMyLocation}>
          <LocateFixed className="size-3.5" />
          {t("useMyLocation")}
        </Button>
      </div>

      <div
        ref={mapShellRef}
        className="relative z-0 h-72 w-full overflow-hidden rounded-xl border bg-muted/20 shadow-sm sm:h-80"
      >
        <div
          ref={mapContainerRef}
          className="absolute inset-0 z-0 h-full w-full"
          role="application"
          aria-label={t("mapAriaLabel")}
        />
      </div>

      <div className="grid grid-cols-1 items-end gap-3 sm:grid-cols-2 xl:grid-cols-[1fr_1fr_minmax(14rem,1.4fr)_auto]">
        <div className="space-y-2">
          <Label htmlFor="attendance.gym_latitude">{t("latitude")}</Label>
          <Input
            id="attendance.gym_latitude"
            name="attendance.gym_latitude"
            type="number"
            step="0.000001"
            value={lat}
            onChange={(event) => setLat(event.target.value)}
            placeholder="30.044400"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="attendance.gym_longitude">{t("longitude")}</Label>
          <Input
            id="attendance.gym_longitude"
            name="attendance.gym_longitude"
            type="number"
            step="0.000001"
            value={lng}
            onChange={(event) => setLng(event.target.value)}
            placeholder="31.235700"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="attendance.gym_radius_meters">
            {t("radiusMeters")} ({radiusNumber}m)
          </Label>
          <div className="flex items-center gap-2">
            <input
              id="attendance.gym_radius_meters"
              name="attendance.gym_radius_meters"
              type="range"
              min={MIN_RADIUS}
              max={MAX_RADIUS}
              step={10}
              value={radiusNumber}
              onChange={(event) => setRadius(event.target.value)}
              className="h-8 min-w-0 flex-1 cursor-pointer accent-teal-700"
            />
            <Input
              type="number"
              min={MIN_RADIUS}
              max={MAX_RADIUS}
              value={radius}
              onChange={(event) => setRadius(event.target.value)}
              aria-label={t("radiusMeters")}
              className="w-20 shrink-0"
            />
          </div>
        </div>
        <Button type="button" variant="secondary" className="w-full xl:w-auto" onClick={applyManualCoordinates}>
          <Crosshair className="size-3.5" />
          {t("centerMap")}
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-2 text-muted-foreground text-xs">
        <MapPin className="size-3.5 shrink-0" />
        <span>
          {hasPoint
            ? t("mapSelectedPoint", {
                lat: latNumber.toFixed(6),
                lng: lngNumber.toFixed(6),
                radius: radiusNumber,
              })
            : t("mapNoPoint")}
        </span>
        {status ? <span className="text-foreground">· {status}</span> : null}
      </div>
    </div>
  );
}
