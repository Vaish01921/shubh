# How to Test Show Search Button Automation

Use these steps to confirm that the **Show Search** button automation is running successfully.

---

## 1. Check the logs

When you run a bid (e.g. `POST /api/start-bid`), look for these log lines in order:

| Log message | Meaning |
|-------------|--------|
| `🔘 Clicked header 'Show Search' (upper-right)` or `🔘 Clicked 'Show Search' via JavaScript` or `🔘 Clicked header 'Show Search' (config id)` | The Show Search button was found and clicked. |
| `🔍 Filter panel already expanded (Hide Search visible), skipping click` | The filter panel was already open (no click needed). |
| `🔍 Search filter section is visible` | The filter section (Ship From Plant, Depot) is visible after expanding. |
| `📸 Stage screenshot: ... stage_after_show_search_<depot>.png` | A screenshot was saved right after the panel expanded. |
| `✅ Filled Ship from plant: ...` and `✅ Filled Depot: ...` | Ship From Plant and Depot fields were filled. |
| `📸 Stage screenshot: ... stage_filters_filled_<depot>.png` | A screenshot was saved after filling the filters. |
| `🔎 Search button clicked` or `🔎 Search clicked — waiting for Order List table` | The Search button (magnifying glass) was clicked. |

**If Show Search failed:** you may see only `Could not click Show Search: ...` and then `Filter section not visible after Show Search, trying initial button` or errors in `_fill_filters`.

---

## 2. Run a test with the browser visible (local)

1. Set **headless: false** in `.env` or `application.yaml` so the browser window opens.
2. Start the backend:
   ```bash
   python backend_server.py
   ```
3. Call the API with **sync=true** so the run finishes before the browser closes:
   ```bash
   curl -X POST "http://127.0.0.1:8000/api/start-bid?sync=true" -H "Content-Type: application/json" -d "{\"truck_id\": \"test1\", \"depot\": \"AYODHYA\"}"
   ```
4. Watch the browser:
   - After login, the E-Bidding page should open.
   - The **Show Search** button (top-right) should be clicked and the filter panel should expand (button changes to **Hide Search**).
   - **Ship From Plant** and **Depot** should get filled, then the **Search** button should be clicked.

---

## 3. Check the stage screenshots

After a run, look in the **`screenshots/`** folder:

| File | When it’s created | What to check |
|------|-------------------|----------------|
| `stage_after_show_search_<depot>.png` | Right after the filter section is detected | Filter panel is expanded; you see **Hide Search** (top-right), and **Ship From Plant**, **Depot** (and other filter fields). |
| `stage_filters_filled_<depot>.png` | After Ship From Plant and Depot are filled | Same panel with **Ship From Plant** and **Depot** filled with your config/request values. |

If **Show Search** automation worked:

- `stage_after_show_search_*.png` should show the **expanded** filter section (like your reference screenshot with “Hide Search” and the filter inputs).
- If that screenshot is missing or still shows “Show Search” and no filter fields, the click or wait for the filter section failed.

---

## 4. Quick checklist

- [ ] Logs show one of: `Clicked header 'Show Search'` or `Filter panel already expanded`.
- [ ] Logs show `🔍 Search filter section is visible`.
- [ ] File `screenshots/stage_after_show_search_<depot>.png` exists and shows the expanded panel (Hide Search + filter fields).
- [ ] Logs show `✅ Filled Ship from plant` and `✅ Filled Depot`.
- [ ] File `screenshots/stage_filters_filled_<depot>.png` exists and shows the same panel with fields filled.
- [ ] Logs show `🔎 Search clicked` and the run continues (e.g. table load, bidding logic).

If all of the above are true, **Show Search** automation is running successfully.

---

## 5. If it’s not working

1. **Screenshot**  
   Open `stage_after_show_search_<depot>.png` (or the failure screenshot). If the filter panel is not expanded, the click or selector failed.

2. **Header button ID**  
   On the E-Bidding page, right‑click the **Show Search** button → Inspect, copy the element’s `id`. Set in `application.yaml`:
   ```yaml
   sap:
     header_show_search_button_id: "__buttonX-BDI-content"   # use the real ID
   ```

3. **Logs**  
   Search the log output for `Show Search`, `Filter section`, `_fill_filters`, and any Python tracebacks to see whether the failure is at click, wait, or fill.
