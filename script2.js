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

// note that the data is actually limited to the past 10 years now
const latest_year = d3.max(data, d => d.date.getFullYear());
const recent_data = data.filter(d => d.date.getFullYear() >= latest_year - 9);

const monthly = [];

recent_data.forEach(d => {
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

// 5. color + tooltip + setup of mini chart lines
// ---------------------------------------------------

const color = d3.scaleSequential()
    .domain([
        d3.min(monthly, d => d.max),
        d3.max(monthly, d => d.max)
    ])
    .interpolator(d3.interpolateOranges);

// shared temperature range for the mini chart lines
const min_temp = d3.min(recent_data, d => d.min);
const max_temp = d3.max(recent_data, d => d.max);

// different colors for the mini chart lines
const max_color = "green";
const min_color = "cyan";

// the tooltip is the small popup that appears whenever hovering over a cell
const tooltip = d3.select("#tooltip");

// the following 3 functions are functions related to interacting with the cell
// display tooltip when hovering mouse over cell
const mouse_over = function(event, d) {
    tooltip.style("visibility", "visible");
};

// display year-month, maxT, minT
// it seems like part 2 implements it so that the tooltip can distinguish each day on the mini chart line
// i was unsuccessful in implementing it like that; i reverted to the part 1 standard tooltip that displays month-wide info
const mouse_move = function(event, d) {
    // format of containing data changed, so now retrieval of the specific record is needed first
    const record = monthly.find(m => m.year === d.year && m.month === d.month);
    if (record){
        tooltip
            .style("left", (event.pageX + 10) + "px")
            .style("top", (event.pageY + 10) + "px")
            .html(`
                Date: ${d.year}-${d.month + 1};
                max: ${record.max.toFixed(1)} °C;
                min: ${record.min.toFixed(1)} °C
            `);
    }
    
};

// hide tooltip when mouse exits cell
const mouse_leave = function() {
    tooltip.style("visibility", "hidden");
};

// 6. create matrix cells
// ---------------------------------------------------

// each cell = a year + month combination
// the cell contains the background rectangle (part 1) and the mini chart lines
const cell_data = years.flatMap(year =>
    d3.range(12).map(month => ({
        year: year,
        month: month,
        // days can be filtered by only selected records in that year + month combination
        days: recent_data.filter(d =>
            d.date.getFullYear() === year && d.date.getMonth() === month
        )
    }))
);

const cells = svg.selectAll(".cell")
    .data(cell_data)
    .join("g")
    .attr("class", "cell")
    .attr("transform", d => `translate(${x(d.year)},${y(d.month)})`)
    .on("mouseover", mouse_over)
    .on("mousemove", mouse_move)
    .on("mouseout", mouse_leave);

// dimensions of each mini chart per cell
const cell_width = x.bandwidth();
const cell_height = y.bandwidth();
const inner_width = cell_width - 5;
const inner_height = cell_height - 5;

// 7. draw the background cells/rect
// ---------------------------------------------------
cells.append("rect")
    .attr("width", cell_width)
    .attr("height", cell_height)
    .attr("fill", d => {
        const record = monthly.find(m => m.year === d.year && m.month === d.month);
        return record ? color(record.max) : "black";
    })
    .attr("stroke", "white")
    .attr("stroke-width", 1);

// x direction represents the day
const day_scale = d3.scaleLinear()
    .domain([1,31])
    .range([0, inner_width]);

const temp_scale = d3.scaleLinear()
    .domain([min_temp, max_temp])
    .range([inner_height, 0]);

cells.each(function(cell) {
    const group = d3.select(this);
    const chart = group.append("g")
        .attr("transform", "translate(2,2)");
    
    // the daily max temp line
    chart.append("path")
        .datum(cell.days)
        .attr("fill", "none")
        .attr("stroke", max_color)
        .attr("stroke-width", 1)
        .attr("d", d3.line()
            .defined(d => Number.isFinite(d.max))
            .x(d => day_scale(d.date.getDate()))
            .y(d => temp_scale(d.max))
        );
    
    // the daily min temp line
    chart.append("path")
        .datum(cell.days)
        .attr("fill", "none")
        .attr("stroke", min_color)
        .attr("stroke-width", 1)
        .attr("d", d3.line()
            .defined(d => Number.isFinite(d.min))
            .x(d => day_scale(d.date.getDate()))
            .y(d => temp_scale(d.min))
        );
});


// 8. legend setup
// ---------------------------------------------------

// the legend as required by the rubric
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

const legend_scale = d3.scaleLinear()
    .domain([d3.min(monthly, d => d.max), d3.max(monthly, d => d.max)])
    .range([height, 0]);

legend_axis.call(d3.axisRight(legend_scale).ticks(6));

// legend title
legend.append("text")
    .attr("transform", `rotate(-90, ${15 + 60}, ${height / 2})`)
    .attr("x", 15 + 30)
    .attr("y", height / 2)
    .attr("text-anchor", "start")
    .text("Temperature (°C)");

})();
