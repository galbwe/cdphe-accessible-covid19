import { formatDate, sortObjectsByDate } from "./utilities";

import { API_URLS } from "./constants";

export async function getDailyStatistics() {

    function cleanDailyStats(data) {
        let newData = [];
        data.map((attr) => newData.push(...Object.values(attr)));
        let filteredData = newData.filter((attr) => attr.Date !== null);
        return sortObjectsByDate(filteredData, false);
    }

    return await fetch(API_URLS.dailyStatistics)
        .then((res) => res.json())
        .then((resJson) => {
            return cleanDailyStats(resJson.features);
        })
        .catch((err) => console.log(err));
}

export async function getTestingStatistics(testType) {
    // see link below for valid field names and metrics
    // https://data-cdphe.opendata.arcgis.com/datasets/covid19-positivity-data-from-clinical-laboratories/geoservice
    let description;
    if (testType === 'antibody') {
        description = "Daily COVID-19 Antibody Test Data From Clinical Laboratories"
    } else if (testType === 'pcr') {
        description = "Daily COVID-19 PCR Test Data From Clinical Laboratories";
    } else {
        console.log(`Unknown test type ${testType}. Try "antibody" or "pcr".`)
    }

    const metrics = [
        // "Total Tests per 100K People",
        "Percent Positivity",
        "3-Day Average Percent Positivity",
        "7-Day Average Percent Positivity",
        "Total Tests per 100K People",
        "People Tested at Non-CDPHE (Commerical) Labs",
        "People Tested at CDPHE State Lab",
        "Antibody Tests Performed",
        "Number of negative tests",
        "Number of positive tests",
    ]

    const metricAliases = {
        "Percent Positivity": "percentPositive",
        "3-Day Average Percent Positivity": "percentPositive3DayAvg",
        "7-Day Average Percent Positivity": "percentPositive7DayAvg",
        "Total Tests per 100K People": "testsPer100KPeople",
        "People Tested at Non-CDPHE (Commerical) Labs": "testedAtCommercialLabs",
        "People Tested at CDPHE State Lab": "testedAtStateLabs",
        "Antibody Tests Performed": "antibodyTests",
        "Number of negative tests": "negativeTests",
        "Number of positive tests": "positiveTests",
    }

    const metricAggregators = {
        "People Tested at Non-CDPHE (Commercial) Labs": function(a, b){ return a + b; },
        "Percent Positivity": function(a, b) { return a },
        "3-Day Average Percent Positivity": function(a, b) { return a },
        "7-Day Average Percent Positivity": function(a, b) {return a },
        "Total Tests per 100K People": function(a, b) { return a },
        "People Tested at CDPHE State Lab": function(a, b){ return a + b },
        "Antibody Tests Performed": function(a, b){ return a + b},
        "Number of negative tests": function(a, b) { return a + b},
        "Number of positive tests": function(a, b) { return a + b},
    }

    function buildUrl() {
        const outFields = ['Desc_', 'Metric', 'Value', 'Attr_Date'].join(',');
        const queryString = `?where=1%3D1&outFields=${outFields}&outSR=4326&f=json`;
        return API_URLS.testPositivity + queryString;
    }

    function cleanTestingStats({features}) {
        let allAttributes = features.map(x => x.attributes);
        let filteredAttributes = allAttributes.filter(x => {
            return (
                description === x.Desc_
                && metrics.includes(x.Metric)
                && !isNaN(x.Value)
            )
        });
        let groupedByDate = filteredAttributes.reduce(
           (agg, obj) => {
                const formattedDate = formatDate(obj.Attr_Date, 'yyyy-mm-dd');
                let key = metricAliases[obj.Metric];
                let metricAgg = metricAggregators[obj.Metric];
                if (formattedDate in agg) {
                    let record = agg[formattedDate];
                    if (key in record) {
                        // record[key] = metricAgg(record[key], obj[key]);
                        record[key] = metricAgg(record[key], obj.Value);
                    } else {
                        record[key] = obj.Value;
                    }
                } else {
                    agg[formattedDate] = {};
                    agg[formattedDate][key] = obj.Value;
                    agg[formattedDate].date = formattedDate;
                }
                return agg;
           }
        , {})
        let sortedAttributes = sortObjectsByDate(
            Object.values(groupedByDate),
            true,
            x => {
                return new Date(x.date);
            }
        )
        return sortedAttributes;
    }

    function addComputedFields(data) {
        return data.map(x => {
            x['totalTested'] = null;
            if (('testedAtCommercialLabs' in x) && ('testedAtStateLabs' in x)){
                x['totalTested'] = x.testedAtCommercialLabs + x.testedAtStateLabs;
            }
            return x;
        })
    }

    return await fetch(buildUrl())
        .then((res) => res.json())
        .then((resJson) => {
            return cleanTestingStats(resJson);
        })
        .then((cleanedData) => {
            return addComputedFields(cleanedData);
        })
        .catch((err) => console.log(err));
}
