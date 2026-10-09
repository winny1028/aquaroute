/* =====================================================
   FLOODSMART ROUTE
   Hackathon Prototype
   ===================================================== */
let map;

let routeLines = [];

let floodCircles = [];

let userMarker = null;

let safestRouteIndex = 0;

let currentRoutes = [];

/* =====================================================
   DEMO FLOOD DATA
   ===================================================== */

/*
   IMPORTANT:

   These are DEMONSTRATION flood zones.

   For your final real-world deployment,
   replace these coordinates with verified
   flood/municipal/weather data.
*/


const floodZones = [

    {
        name: "Musi River Risk Zone",

        lat: 17.3650,

        lng: 78.4700,

        radius: 1100,

        risk: "HIGH"
    },


    {
        name: "Low Lying Area",

        lat: 17.3900,

        lng: 78.4800,

        radius: 900,

        risk: "HIGH"
    },


    {
        name: "Urban Waterlogging Zone",

        lat: 17.4050,

        lng: 78.4750,

        radius: 850,

        risk: "MODERATE"
    },


    {
        name: "Drainage Risk Area",

        lat: 17.3500,

        lng: 78.5200,

        radius: 800,

        risk: "MODERATE"
    }

];
/* =====================================================
   INITIALIZE GOOGLE MAP
   ===================================================== */
async function initMap() {

    const {

        Map

    } = await google.maps.importLibrary("maps");


    map = new Map(
        document.getElementById("map"),
        {

            center: {
                lat: 17.3850,
                lng: 78.4867
            },

            zoom: 12,

            mapTypeControl: true,

            streetViewControl: false,

            fullscreenControl: true

        }
    );


    drawFloodZones();


    setupAutocomplete();

}


/* =====================================================
   AUTOCOMPLETE
   ===================================================== */


function setupAutocomplete() {

    const start =
        document.getElementById("start");


    const destination =
        document.getElementById("destination");


    new google.maps.places.Autocomplete(start);


    new google.maps.places.Autocomplete(
        destination
    );

}


/* =====================================================
   DRAW FLOOD ZONES
   ===================================================== */
function drawFloodZones() {

    floodZones.forEach(zone => {

        let color;


        if (zone.risk === "HIGH") {

            color = "#ef4444";

        }

        else {

            color = "#f59e0b";

        }


        const circle =
            new google.maps.Circle({

                map: map,

                center: {

                    lat: zone.lat,

                    lng: zone.lng

                },

                radius: zone.radius,

                strokeColor: color,

                strokeOpacity: 0.8,

                strokeWeight: 2,

                fillColor: color,

                fillOpacity: 0.20

            });


        floodCircles.push(circle);

    });

}


/* =====================================================
   CURRENT LOCATION
   ===================================================== */


function useMyLocation() {

    if (!navigator.geolocation) {

        alert(
            "Location is not supported by this browser."
        );

        return;
    }


    navigator.geolocation.getCurrentPosition(

        position => {

            const location = {

                lat: position.coords.latitude,

                lng: position.coords.longitude

            };


            map.setCenter(location);

            map.setZoom(15);


            if (userMarker) {

                userMarker.setMap(null);

            }


            userMarker =
                new google.maps.Marker({

                    position: location,

                    map: map,

                    title: "Your Location"

                });


            document.getElementById("start").value =
                "My Current Location";

        },


        () => {

            alert(
                "Unable to get your location. Please enter the starting location manually."
            );

        }

    );

}


/* =====================================================
   FIND ROUTES
   ===================================================== */


async function findSafeRoutes() {

    const start =
        document.getElementById("start").value.trim();


    const destination =
        document.getElementById("destination").value.trim();


    if (!start || !destination) {

        alert(
            "Please enter both starting point and destination."
        );

        return;

    }


    setLoading();


    try {

        const {

            Route,
            TravelMode

        } =
            await google.maps.importLibrary("routes");


        const request = {

            origin: start,

            destination: destination,

            travelMode: TravelMode.DRIVING,

            computeAlternativeRoutes: true,

            fields: [

                "routes",

                "routes.path",

                "routes.distanceMeters",

                "routes.durationMillis",

                "routes.routeLabels",

                "routes.viewport"

            ]

        };


        const result =
            await Route.computeRoutes(request);


        if (
            !result.routes ||
            result.routes.length === 0
        ) {

            throw new Error(
                "No route found."
            );

        }


        currentRoutes =
            result.routes;


        analyzeRoutes(
            result.routes
        );

    }


    catch (error) {

        console.error(error);


        resetLoading();


        alert(
            "Unable to calculate routes. Check your Google Maps API configuration and billing."
        );

    }

}


/* =====================================================
   ANALYZE ROUTES
   ===================================================== */


function analyzeRoutes(routes) {

    clearRoutes();


    const analyzed = [];


    routes.forEach(

        (route, index) => {

            const risk =
                calculateRouteRisk(route);


            analyzed.push({

                route: route,

                index: index,

                risk: risk

            });

        }

    );


    /*
       Lowest flood risk wins.

       If two routes have equal risk,
       the shorter route wins.
    */


    analyzed.sort(

        (a, b) => {

            if (
                a.risk.score !==
                b.risk.score
            ) {

                return (
                    a.risk.score -
                    b.risk.score
                );

            }


            return (
                a.route.distanceMeters -
                b.route.distanceMeters
            );

        }

    );


    safestRouteIndex =
        analyzed[0].index;


    drawRoutes(analyzed);


    showDashboard(analyzed);


    resetLoading();

}


/* =====================================================
   CALCULATE FLOOD RISK
   ===================================================== */


function calculateRouteRisk(route) {

    let score = 0;

    let highRiskCount = 0;

    let moderateRiskCount = 0;


    /*
       Examine route path points.

       If a route passes near a flood
       zone, increase the risk score.
    */


    if (route.path) {

        route.path.forEach(point => {

            floodZones.forEach(zone => {

                const zoneLocation =
                    new google.maps.LatLng(

                        zone.lat,

                        zone.lng

                    );


                const distance =
                    google.maps.geometry.spherical
                    .computeDistanceBetween(

                        point,

                        zoneLocation

                    );


                if (
                    distance <
                    zone.radius
                ) {

                    if (
                        zone.risk ===
                        "HIGH"
                    ) {

                        score += 5;

                        highRiskCount++;

                    }

                    else {

                        score += 2;

                        moderateRiskCount++;

                    }

                }

            });

        });

    }


    /*
       Prevent duplicate counting
       from every nearby point.

       Normalize the score.
    */


    score =
        Math.min(
            100,
            score
        );


    let level;


    if (score >= 25) {

        level = "HIGH";

    }

    else if (score >= 10) {

        level = "MODERATE";

    }

    else {

        level = "LOW";

    }


    return {

        score: score,

        level: level,

        highRiskCount: highRiskCount,

        moderateRiskCount:
            moderateRiskCount

    };

}


/* =====================================================
   DRAW ROUTES
   ===================================================== */


function drawRoutes(analyzed) {

    analyzed.forEach(

        item => {

            const isSafest =
                item.index ===
                safestRouteIndex;


            const color =
                isSafest
                    ? "#16a34a"
                    : "#64748b";


            const weight =
                isSafest
                    ? 8
                    : 5;


            const opacity =
                isSafest
                    ? 0.9
                    : 0.55;


            const line =
                new google.maps.Polyline({

                    map: map,

                    path: item.route.path,

                    strokeColor: color,

                    strokeOpacity:
                        opacity,

                    strokeWeight:
                        weight,

                    zIndex:
                        isSafest
                            ? 10
                            : 5

                });


            routeLines.push(line);

        }

    );


    /*
       Fit map around safest route.
    */


    const safest =
        analyzed.find(

            item =>
                item.index ===
                safestRouteIndex

        );


    if (
        safest &&
        safest.route.viewport
    ) {

        map.fitBounds(
            safest.route.viewport
        );

    }

}


/* =====================================================
   DASHBOARD
   ===================================================== */
function showDashboard(analyzed) {

    const safest =
        analyzed.find(

            item =>
                item.index ===
                safestRouteIndex

        );


    const risk =
        safest.risk;


    const route =
        safest.route;


    /* Distance */


    document.getElementById(
        "distance"
    ).innerText =
        formatDistance(
            route.distanceMeters
        );


    /* Duration */


    document.getElementById(
        "duration"
    ).innerText =
        formatDuration(
            route.durationMillis
        );


    /* Risk */


    document.getElementById(
        "risk-score"
    ).innerText =
        risk.score;


    /* Number of routes */


    document.getElementById(
        "route-count"
    ).innerText =
        analyzed.length;


    updateRiskCard(risk);


    updateRecommendation(
        risk
    );


    showRouteCards(
        analyzed
    );

}


/* =====================================================
   RISK CARD
   ===================================================== */
function updateRiskCard(risk) {

    const level =
        document.getElementById(
            "risk-level"
        );


    const message =
        document.getElementById(
            "risk-message"
        );


    const card =
        document.getElementById(
            "status-card"
        );


    if (risk.level === "HIGH") {

        level.innerText =
            "🔴 HIGH RISK";


        message.innerText =
            "Flood-prone areas detected along the recommended route.";


        card.style.borderLeftColor =
            "#ef4444";

    }


    else if (
        risk.level === "MODERATE"
    ) {

        level.innerText =
            "🟠 MODERATE RISK";


        message.innerText =
            "Some flood-risk areas are near the recommended route.";


        card.style.borderLeftColor =
            "#f59e0b";

    }


    else {

        level.innerText =
            "🟢 LOW RISK";


        message.innerText =
            "No major flood-risk zones were detected on this route.";


        card.style.borderLeftColor =
            "#22c55e";

    }

}


/* =====================================================
   RECOMMENDATION
   ===================================================== */
function updateRecommendation(risk) {

    const box =
        document.getElementById(
            "recommendation"
        );


    if (risk.level === "HIGH") {

        box.innerHTML = `

            <div class="recommendation-icon">
                🚨
            </div>

            <div>

                <h3>
                    Safety Recommendation
                </h3>

                <p>
                    High-risk flood zones were
                    detected. Avoid low-lying roads
                    and monitor local warnings
                    before travelling.
                </p>

            </div>

        `;

    }


    else if (
        risk.level === "MODERATE"
    ) {

        box.innerHTML = `

            <div class="recommendation-icon">
                ⚠️
            </div>

            <div>

                <h3>
                    Safety Recommendation
                </h3>

                <p>
                    Travel with caution and
                    monitor changing rainfall
                    and flood conditions.
                </p>

            </div>

        `;

    }


    else {

        box.innerHTML = `

            <div class="recommendation-icon">
                🛡️
            </div>

            <div>

                <h3>
                    Safety Recommendation
                </h3>

                <p>
                    This route has the lowest
                    detected flood-risk score
                    among the available routes.
                </p>

            </div>

        `;

    }

}


/* =====================================================
   ROUTE CARDS
   ===================================================== */
function showRouteCards(analyzed) {

    const container =
        document.getElementById(
            "route-list"
        );


    container.innerHTML = "";


    analyzed.forEach(

        (item, position) => {

            const route =
                item.route;


            const risk =
                item.risk;


            const isSafest =
                item.index ===
                safestRouteIndex;


            let riskClass =
                "low";


            if (
                risk.level ===
                "MODERATE"
            ) {

                riskClass =
                    "medium";

            }


            if (
                risk.level ===
                "HIGH"
            ) {

                riskClass =
                    "high";

            }


            const card =
                document.createElement(
                    "div"
                );


            card.className =
                "route-item " +
                (
                    isSafest
                        ? "selected"
                        : ""
                );


            card.innerHTML = `

                <div class="route-top">

                    <span class="route-name">

                        ${isSafest
                            ? "🛡️ "
                            : ""}

                        Route ${position + 1}

                        ${isSafest
                            ? " — SAFEST"
                            : ""}

                    </span>


                    <span
                        class="route-risk ${riskClass}">

                        ${risk.level}

                    </span>

                </div>


                <div class="route-details">

                    <span>

                        📏
                        ${formatDistance(
                            route.distanceMeters
                        )}

                    </span>


                    <span>

                        ⏱️
                        ${formatDuration(
                            route.durationMillis
                        )}

                    </span>


                    <span>

                        🌊
                        ${risk.score}

                    </span>

                </div>

            `;


            card.onclick =
                () => {

                    highlightRoute(
                        item.index
                    );

                };


            container.appendChild(
                card
            );

        }

    );

}


/* =====================================================
   HIGHLIGHT SELECTED ROUTE
   ===================================================== */
function highlightRoute(index) {

    routeLines.forEach(

        (line, i) => {

            /*
               Route ordering corresponds
               to original route indexes.
            */


            if (i === index) {

                line.setOptions({

                    strokeWeight: 9,

                    strokeOpacity: 1,

                    zIndex: 20

                });

            }

            else {

                line.setOptions({

                    strokeWeight: 4,

                    strokeOpacity: 0.35,

                    zIndex: 5

                });

            }

        }

    );

}


/* =====================================================
   CLEAR ROUTES
   ===================================================== */


function clearRoutes() {

    routeLines.forEach(

        line =>
            line.setMap(null)

    );


    routeLines = [];

}


/* =====================================================
   FORMATTING
   ===================================================== */


function formatDistance(meters) {

    if (
        meters < 1000
    ) {

        return (
            Math.round(meters) +
            " m"
        );

    }


    return (
        (meters / 1000)
            .toFixed(1) +
        " km"
    );

}


function formatDuration(milliseconds) {

    const minutes =
        Math.round(
            milliseconds /
            60000
        );


    if (
        minutes < 60
    ) {

        return (
            minutes +
            " min"
        );

    }


    const hours =
        Math.floor(
            minutes / 60
        );


    const remaining =
        minutes % 60;


    return (

        hours +
        "h " +
        remaining +
        "m"

    );

}


/* =====================================================
   LOADING
   ===================================================== */
function setLoading() {

    document.getElementById(
        "risk-level"
    ).innerText =
        "⏳ ANALYZING";


    document.getElementById(
        "risk-message"
    ).innerText =
        "Comparing routes with flood-risk zones...";


    document.getElementById(
        "route-list"
    ).innerHTML = `

        <div class="empty-route">

            🌊 Analyzing flood risk...

        </div>

    `;

}


function resetLoading() {

    console.log(
        "FloodSmart analysis completed."
    );

}
