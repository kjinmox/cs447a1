(async function() {

// 1. set up chart dimensions and the SVG drawing area
// ---------------------------------------------------
const margin = { left: 50, top: 20, right: 100, bottom: 40 };
const width = 800 - margin.left - margin.right;
const height = 500 - margin.top - margin.bottom;

const svg = d3.select("#chart")
    .append("svg")
    .attr("width", width + margin.left + margin.right)
    .attr("height", height + margin.top + margin.bottom)
    .append("g")
    .attr("transform", `translate(${margin.left},${margin.top})`);


// 2. define initial display configs + read data
// ---------------------------------------------------

// initially, page will show the monthly maximum temperatures
// a toggle button later will allow users to switch between min/max temperature
let type = "max";
const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// read the data
// each row in original file contains a Date, and two numeric vals
// data has attributes: date, max, min
const data = await d3.csv("temperature_daily.csv", (d) => {
    return {
        date: d3.timeParse("%Y-%m-%d")(d.date),
        max: +d.max_temperature,
        min: +d.min_temperature
    }
});

// 3. group the daily temperature data into monthly records
// ---------------------------------------------------

// one record for each year + month combination
// for each record, store the highest daily max temperature and lowest daily min temperature
const monthly = [];

data.forEach(d => {
    const year = d.date.getFullYear();
    const month = d.date.getMonth();

    let record = monthly.find(
        m => m.year === year && m.month === month
    );

    if (!record) {
        // first entry of this month
        record = {
            year: year,
            month: month,
            max: d.max,
            min: d.min
        };

        monthly.push(record);
    } else {
        // keep the highest daily maximum and lowest daily minimum for this month
        record.max = Math.max(record.max, d.max);
        record.min = Math.min(record.min, d.min);
    }
});

// 4. set up axes + draw axes
// ---------------------------------------------------

// extract the years from the monthly array to get the range of years
// columns of the heatmap
const years = [...new Set(monthly.map(d => d.year))].sort((a, b) => a - b);

// horizontal, divided by years
const x = d3.scaleBand()
    .domain(years)
    .range([0, width])
    .padding(0.05);

// vertical, divided by month
const y = d3.scaleBand()
    .domain(d3.range(12))
    .range([0, height])
    .padding(0.05);

// display year labels
svg.append("g")
    .call(d3.axisTop(x));

// display month labels
svg.append("g")
    .call(d3.axisLeft(y).tickFormat(d => months[d]));

// 5. color + tooltip
// ---------------------------------------------------

const color = d3.scaleSequential()
    .interpolator(d3.interpolateOranges);

// the tooltip is the small popup that appears whenever hovering over a cell
const tooltip = d3.select("#tooltip");

// the following 3 functions are functions related to interacting with the cell
// display tooltip when hovering mouse over cell
const mouse_over = function(event, d) {
    tooltip.style("visibility", "visible");
};

// display year-month, maxT, minT
const mouse_move = function(event, d) {
    tooltip
        .style("left", (event.pageX + 10) + "px")
        .style("top", (event.pageY + 10) + "px")
        .html(`
            Date: ${d.year}-${d.month + 1};
            max: ${d.max.toFixed(1)} °C;
            min: ${d.min.toFixed(1)} °C
        `);
};

// hide tooltip when mouse exits cell
const mouse_leave = function() {
    tooltip.style("visibility", "hidden");
};

// 6. create matrix cells
// ---------------------------------------------------

// bind each monthly record to a cell/rects
const cells = svg.selectAll(".cell")
    .data(monthly)
    .join("rect")
    .attr("class", "cell")
    .attr("x", d => x(d.year))
    .attr("y", d => y(d.month))
    .attr("width", x.bandwidth())
    .attr("height", y.bandwidth())
    .attr("stroke", "white")
    .on("mouseover", mouse_over)
    .on("mousemove", mouse_move)
    .on("mouseout", mouse_leave);


// 7. legend setup
// ---------------------------------------------------


// the legend as required by the rubric
// it will only be actually appended later during the update function
// this is to account for the fact that the chart can be toggled to display min/max temperature
// the legend must be able to change scale to account for this
const legend = svg.append("g")
    .attr("transform", `translate(${width + 20},0)`);

// vertical gradient for the color bar
const defs = svg.append("defs");
const gradient = defs.append("linearGradient")
    .attr("id", "orange-gradient")
    .attr("x1", "0%")
    .attr("y1", "100%")
    .attr("x2", "0%")
    .attr("y2", "0%");
d3.range(11).forEach(i => {
    gradient.append("stop")
        .attr("offset", `${i * 10}%`)
        .attr("stop-color", d3.interpolateOranges(i / 10));
});



// draw the color bar
legend.append("rect")
    .attr("width", 15)
    .attr("height", height)
    .attr("fill", "url(#orange-gradient)");

// space for the temperature labels
const legend_axis = legend.append("g")
    .attr("transform", "translate(15, 0)");

// legend title
legend.append("text")
    .attr("transform", "rotate(-90)")
    .attr("x", -height / 2)
    .attr("y", -45)
    .attr("text-anchor", "middle")
    .text("Temperature (°C)");

// 8. update function (for toggle)
// ---------------------------------------------------    

// this function recalculates the color mapping and updates the legend for the selected temperature (min/max)
function update() {
    const values = monthly.map(d => d[type]);

    const min_temp = d3.min(values);
    const max_temp = d3.max(values);

    // map temperature to orange shades
    color.domain([min_temp, max_temp]);

    // update cell colors
    cells.attr("fill", d => color(d[type]));

    // update legend labels
    const legend_scale = d3.scaleLinear()
        .domain([min_temp, max_temp])
        .range([height, 0]);

    legend_axis.call(
        d3.axisRight(legend_scale).ticks(6)
    );

    // update button label
    d3.select("#toggle").text(
        type === "max" ? "Show Minimum Temperature" : "Show Maximum Temperature"
    );
}

// switch between maximum and minimum
d3.select("#toggle").on("click", () => {
    type = type === "max" ? "min" : "max";
    update();
});

// draw the initial view
update();
})();
