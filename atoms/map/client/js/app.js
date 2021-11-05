import * as d3B from 'd3'
import * as topojson from 'topojson'
import * as geoProjection from 'd3-geo-projection'
import worldMap from 'assets/ne_10m_admin_0_countries_crimea_ukraine_simple.json'

//https://interactive.guim.co.uk/2021/11/climate-tracker/mapdata.json


const d3 = Object.assign({}, d3B, topojson, geoProjection);

const atomEl = d3.select('.ndc-interactive-wrapper').node()

const isMobile = window.matchMedia('(max-width: 600px)').matches;

let width = atomEl.getBoundingClientRect().width;
let height =  width * 2.5 / 5;

let projection = d3.geoRobinson();

let path = d3.geoPath()
.projection(projection);

let extent = {
        type: "LineString",

         coordinates: [
            [-180, -60],
            [180, -60],
            [180, 90],
            [-180, 90],
        ]
}

projection
.fitExtent([[0, 0], [width, height]], extent);

const filtered = topojson.feature(worldMap, worldMap.objects['world-map-crimea-ukr']).features.filter(f => f.properties.ADMIN != 'Antarctica')

const map = d3.select('.map-container')
.append('svg')
.attr('id', 'travel-map')
.attr('width', width)
.attr('height', height);

const geo = map.append('g')


d3.json('https://interactive.guim.co.uk/2021/11/climate-tracker/mapdata.json')
.then(data => {

	console.log(data)

	geo
	.selectAll('path')
	.data(filtered)
	.enter()
	.append('path')
	.attr('class', d => d.properties.ISO_A3)
	.attr('d', path)
	.attr('fill', '#DADADA')

	data.forEach(d => {
		geo.select('.' + d.country_code)
		.classed('ranking-' + d.rating, true)
	})

})