/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { CancelablePromise } from '../core/CancelablePromise';
import { OpenAPI } from '../core/OpenAPI';
import { request as __request } from '../core/request';
export class WeatherService {
    /**
     * Current conditions + today's hourly + 7-day forecast for the household.
     *
     * Always returns HTTP 200. ``configured=False`` when the household has no
     * location yet (not an error — the UI shows a "set your location" state).
     * ``error=True`` when Open-Meteo is unreachable (graceful degradation).
     * @returns any No response body
     * @throws ApiError
     */
    public static weatherRetrieve(): CancelablePromise<any> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/weather/',
        });
    }
    /**
     * Proxy Open-Meteo geocoding — used by the owner to pick the household
     * location from a city name. Any authenticated user may query; the resulting
     * coordinates are only *persisted* through the owner-gated household update.
     * @returns any No response body
     * @throws ApiError
     */
    public static weatherGeocodeRetrieve(): CancelablePromise<any> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/weather/geocode/',
        });
    }
    /**
     * Daily mean temperatures over a period, to overlay on the consumption
     * charts (parcours 17 Lot 6). Always HTTP 200; ``configured=False`` when the
     * household has no location, ``error=True`` when the archive is unreachable.
     * The frontend aggregates these daily points to its own consumption buckets.
     * @returns any No response body
     * @throws ApiError
     */
    public static weatherHistoryRetrieve(): CancelablePromise<any> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/weather/history/',
        });
    }
}
