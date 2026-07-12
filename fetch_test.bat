@echo off
curl -s ^
  -H "User-Agent: Mozilla/5.0 Chrome/126" ^
  -H "Accept: application/json" ^
  -H "Referer: https://www.mrxtopup.com/" ^
  -H "Origin: https://www.mrxtopup.com" ^
  -H "x-client-id: mrxtopup-web-v2" ^
  "https://www.mrxtopup.com/api/get-topup-data?id=ff"
echo.
echo --- ML ---
curl -s ^
  -H "User-Agent: Mozilla/5.0 Chrome/126" ^
  -H "Accept: application/json" ^
  -H "Referer: https://www.mrxtopup.com/" ^
  -H "Origin: https://www.mrxtopup.com" ^
  -H "x-client-id: mrxtopup-web-v2" ^
  "https://www.mrxtopup.com/api/get-topup-data?id=ml"
echo.
echo --- validate ff uid ---
curl -s ^
  -H "User-Agent: Mozilla/5.0 Chrome/126" ^
  -H "Accept: application/json" ^
  -H "Referer: https://www.mrxtopup.com/" ^
  -H "Origin: https://www.mrxtopup.com" ^
  -H "x-client-id: mrxtopup-web-v2" ^
  "https://www.mrxtopup.com/api/validate?game=ff&uid=12345678"
echo.
echo --- check uid api ---
curl -s ^
  -H "User-Agent: Mozilla/5.0 Chrome/126" ^
  -H "Accept: application/json" ^
  -H "Referer: https://www.mrxtopup.com/" ^
  -H "Origin: https://www.mrxtopup.com" ^
  -H "x-client-id: mrxtopup-web-v2" ^
  "https://www.mrxtopup.com/api/check-uid?game=ff&uid=12345678"
