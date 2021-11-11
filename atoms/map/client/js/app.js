import * as d3B from 'd3'
import * as topojson from 'topojson'
import * as geoProjection from 'd3-geo-projection'
import ScrollyTeller from "shared/js/scrollyteller"
import worldMap from 'assets/ne_10m_admin_0_countries_crimea_ukraine_simple.json'
import * as moment from 'moment'
import emissionsRaw from 'assets/emissions.json'

//https://interactive.guim.co.uk/2021/11/climate-tracker/mapdata.json


const d3 = Object.assign({}, d3B, topojson, geoProjection);

const atomEl = d3.select('.ndc-interactive-wrapper').node()

const isMobile = window.matchMedia('(max-width: 600px)').matches;

const width = atomEl.getBoundingClientRect().width;
const height = window.innerHeight;

const margin = {top:d3.select('.analysed-countries').node().getBoundingClientRect().height, right:5, bottom:25, left: 0}

let projection = d3.geoRobinson();

let path = d3.geoPath()
.projection(projection);

const radius = d3.scaleSqrt()
.domain([0, d3.max(emissionsRaw, d => +d.emissions)])
.range([3, 20])

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

const centroids = filtered.forEach(feature => feature.properties.centroid = path.centroid(feature))

const map = d3.select('.map-container')
.append('svg')
.attr('id', 'climate-tracker-map')
.attr('width', width)
.attr('height', height);

const tooltip = d3.select('.tooltip-map-list')


const geo = map.append('g')
const bubbles = map.append('g')

const scrolly = new ScrollyTeller({
    parent: document.querySelector("#scrolly-1"),
    triggerTop: 0.5, // percentage from the top of the screen that the trigger should fire
    triggerTopMobile: 1	,
    transparentUntilActive: isMobile ? false : true
});

const mapRatings = [
{rating:1, text: 'submitted stronger NDC'},
{rating:2, text: 'proposed stronger NDC targets'},
{rating:3, text: 'did not increase ambition'},
{rating:4, text: 'will not propose a more ambitious NDC target'},
{rating:5, text: 'submitted new NDC targets'},
{rating:6, text: 'proposed a new NDC target'}
]

const sufficiencyRatings = [
{weight: 0, name: 'No data', center: [-1000, -1000]},
{weight: 1, name: 'Critically insufficient', center: isMobile ? [width / 2, (height + margin.top) / 6] : [width / 6, height / 2]},
{weight: 2, name: 'Highly insufficient', center: isMobile ? [width / 2, ((height + margin.top) / 6) * 2] : [(width / 6) * 2, height / 2]},
{weight: 3, name: 'Insufficient', center: isMobile ? [width / 2, ((height + margin.top) / 6) * 3] :[(width / 6) * 3, height / 2]},
{weight: 4, name: 'Almost Sufficient', center: isMobile ? [width / 2, ((height + margin.top) / 6) * 4] : [(width / 6) * 4, height / 2]},
{weight: 5, name: 'Paris Agreement compatible', center: isMobile ? [width / 2, ((height + margin.top) / 6) * 5] : [(width / 6) * 5, height / 2]}
]

sufficiencyRatings.forEach(d => {

	d3.select('#header-' + d.weight)
	.style('top', isMobile ? (d.center[1] - 30) + 'px' : (d.center[1] - 110) + 'px')
	.style('left', isMobile ? '5px' : (d.center[0] - 50) + 'px')

})


/*d3.select('.scroll-wrapper')
.style('height', (d3.selectAll('.scroll-text__inner').nodes()[0].getBoundingClientRect().height * d3.selectAll('.scroll-text__inner').nodes().length) + 'px')*/
	
let allData;

let nodes = []

let eu = []
	
let simulation = d3.forceSimulation()
.force("cx", d3.forceX().x(d => sufficiencyRatings.find(f => f.weight === d.sufficiency).center[0]).strength(.08))
.force("cy", d3.forceY().y(d => sufficiencyRatings.find(f => f.weight === d.sufficiency).center[1]).strength(.08))
.force( 'collide', d3.forceCollide().radius(d => d.r + 1).iterations(2) )
.velocityDecay(0.3)
.on("tick", d => ticked())
.stop();

let increase = 0

const ticked = () => {

	try {
			bubbles.selectAll('circle')
			.attr('cx', d => d.x)
			.attr('cy', d => d.y)
	}
	catch(err) {

           	console.log(err)
    }

}



d3.json('https://interactive.guim.co.uk/2021/11/climate-tracker/v2/mapdata.json')
.then(data => {

	allData = data;

	allData.updateMapdataWTimestamps.forEach(f => {if(f.name === 'The Gambia'){console.log(f)}})

	let sufficiency = allData.sufficiencyMapdataWTimestamps;

	sufficiency.forEach(d => {

		let emissions = emissionsRaw.find(f => f.country_code === d.country_code);

		if(d.name != 'EU' && d.country_code != 'DEU' && emissions){

			let match = filtered.find(f => f.properties.ISO_A3 === d.country_code)
			let rad = radius(emissions.emissions)
			let cx = match.properties.centroid[0]
			let cy = match.properties.centroid[1]

			nodes.push({country_code:d.country_code, sufficiency:d.rating, r:rad, x:cx, y:cy, centroid:match.properties.centroid, sufficiencyDate:d.timestamp})
			
		}
		else if(!d.country_code){

			emissions = emissionsRaw.find(f => f.country_code === 'EUU');

			let rad = radius(emissions.emissions)
			let match = filtered.find(f => f.properties.ISO_A3 === 'ESP')
			let cx = match.properties.centroid[0]
			let cy = match.properties.centroid[1]

			nodes.push({country_code:'EUU', rating: allData.updateMapdataWTimestamps.find(f => f.country_code === 'ESP').rating, sufficiency:d.rating, r:rad, x:cx, y:cy, centroid:match.properties.centroid, sufficiencyDate:d.timestamp})
		}


	})

	allData.updateMapdataWTimestamps.forEach(data => {

		

		data.name == 'EU' ? eu.push(data.country_code) : ''

		let node = nodes.find(f => f.country_code === data.country_code)

		if(node){
			node.rating = data.rating
			node.dataDate = data.timestamp
		}

		let geoCountry = filtered.find(f => f.properties.ISO_A3 === data.country_code);

		if(geoCountry){

			let suffMatch = sufficiency.find(f => f.country_code ===data.country_code)

			if(suffMatch){

				geoCountry.properties.sufficiency = suffMatch.rating;
				geoCountry.properties.sufficiencyDate = suffMatch.timestamp;
			}
			
		}

		let match = filtered.find(f => f.properties.ISO_A3 === data.country_code)

		match.properties.rating = data.rating;
		match.properties.dataDate = data.timestamp;
	})


	///-------PAINTING------------

	geo
	.selectAll('path')
	.data(filtered)
	.enter()
	.append('path')
	.attr('class', d => {

		console.log(d.properties.ISO_A3,  d.properties.rating)
		return'country-stroke ' + d.properties.ISO_A3 + ' rating-' + d.properties.rating
	})
	.attr('d', path)
	.attr('fill', '#DADADA')
	.attr('stroke-width', 1)
	.filter(d => d.properties.rating)
	.on('mousemove', (e,d) => manageMove(e))
	.on('mouseover', (e,d) => {
		    manageOver(e, d)
	})
	.on('mouseout', () => manageOut())

	geo.append("path")
    .datum(topojson.mesh(worldMap, worldMap.objects['world-map-crimea-ukr'], (a, b) => a !== b ))
    .attr("d", path)
    .attr("class", "subunit-boundary")
	.attr('stroke', '#fff')
	.attr('fill', 'none')
	.attr('stroke-width', 1)

	geo.append("path")
	.datum(topojson.merge(worldMap, worldMap.objects['world-map-crimea-ukr'].geometries.filter(f => eu.indexOf(f.properties.ISO_A3) != -1)))
	.attr("d", path)
	.attr('class', 'country-stroke eu-border')
	.attr('fill', 'none')
	.attr('stroke-width', 1)



//.datum(topojson.merge(us, us.objects.states.geometries.filter(function(d) { return selected.has(d.id); })))
console.log(worldMap.objects['world-map-crimea-ukr'].geometries.filter(f => eu.indexOf(f.properties.ISO_A3) != -1))


	bubbles.selectAll('circle')
	.data(nodes)
	.enter()
	.append('circle')
	.attr('class', d => d.country_code + ' bubble rating-' + d.rating )
	.attr('cx', d => d.centroid[0])
	.attr('cy', d => d.centroid[1])
	.attr('r', 0)
	.attr('stroke', '#fff')
	.attr('stroke-width', 1)
	.on('mousemove', (e,d) => manageMove(e))
	.on('mouseover', (e,d) => {
		    manageOver(e, d)
	})
	.on('mouseout', () => manageOut())


	simulation.nodes(nodes)

	for (let i = 0; i < 120; i++){
	    simulation.tick();
	}


	scrolly.addTrigger({num:1, do: () => {
		geo.selectAll('.country-stroke')
		.attr('stroke', 'none')

		geo
		.selectAll('path')
		.attr('opacity', 1)
		.attr('transform', `scale(1)`)
	}})
	scrolly.addTrigger({num:2, do: () => {

		geo.selectAll('.country-stroke')
		.attr('stroke', 'none')

		geo.selectAll('.USA')
		.raise()
		.attr('stroke', '#333')

		geo
		.selectAll('path')
		.attr('opacity', 1)
		.attr('transform', `scale(1)`)
	}})
	scrolly.addTrigger({num:3, do: () => {

		geo.selectAll('.country-stroke')
		.attr('stroke', 'none')

		geo.selectAll('.CHN')
		.raise()
		.attr('stroke', '#333')

		geo
		.selectAll('path')
		.attr('opacity', 1)
		.attr('transform', `scale(1)`)
	}})
	scrolly.addTrigger({num:4, do: () => {

		geo.selectAll('.country-stroke')
		.attr('stroke', 'none')

		geo.selectAll('.eu-border')
		.raise()
		.attr('stroke', '#333')

		geo
		.selectAll('path')
		.attr('opacity', 1)
		.attr('transform', `scale(1)`)
	}})
	scrolly.addTrigger({num:5, do: () => {

		geo.selectAll('.country-stroke')
		.attr('stroke', 'none')

		geo.selectAll('.IND')
		.raise()
		.attr('stroke', '#333')

		geo
		.selectAll('path')
		.attr('opacity', 1)
		.attr('transform', `scale(1)`)
	}})
	scrolly.addTrigger({num:6, do: () => {

		geo.selectAll('.country-stroke')
		.attr('stroke', 'none')

		geo.selectAll('.BRA')
		.raise()
		.attr('stroke', '#333')

		geo
		.selectAll('path')
		.attr('opacity', 1)
		.attr('transform', `scale(1)`)
	}})
	scrolly.addTrigger({num:7, do: () => {

		geo.selectAll('.country-stroke')
		.attr('stroke', 'none')

		geo.selectAll('.AUS')
		.raise()
		.attr('stroke', '#333')

		geo
		.selectAll('path')
		.attr('opacity', 1)
		.attr('transform', `scale(1)`)

		bubbles.selectAll('circle')
		.transition()
		.duration(500)
		.attr('r', 0)
		.attr('cx', d => d.centroid[0])
		.attr('cy', d => d.centroid[1])


		d3.select('.non-analysed-countries')
		.style('display', 'block')

		d3.select('.analysed-countries p')
		.style('display', 'block')

		d3.select('.blobs-furniture')
		.style('display', 'none')

		
	}})
	scrolly.addTrigger({num:8, do: () => {

		geo.selectAll('.country-stroke')
		.attr('stroke', 'none')

		geo
		.selectAll('path')
		.each(d => {


			if(d.geometry){
				d3.select('.' + d.properties.ISO_A3)
				.transition()
				.duration(1000)
				.attr('transform', `translate(${d.properties.centroid[0]},${d.properties.centroid[1]}) scale(0)`)
				.attr('opacity', 0)
			}
		})

		bubbles
		.selectAll('circle')
		.transition()
		.duration(500)
		.attr('r',d => d.r)
		.on('end', d => positioning())


		function positioning(){
			bubbles.selectAll('circle')
			.transition()
			.duration(500)
			.attr('cx', d => d.x)
			.attr('cy', d => d.y)
		}

		d3.select('.non-analysed-countries')
		.style('display', 'none')

		d3.select('.analysed-countries p')
		.style('display', 'none')

		d3.select('.blobs-furniture')
		.style('display', 'block')


	}})

	scrolly.watchScroll();

})

const manageOut = () => {

	tooltip.classed('over', false)
	tooltip.html('')

	geo.select('.subunit-boundary')
	.raise()

	geo.selectAll('.country-stroke')
	.attr('stroke', 'none')

	bubbles.selectAll('.bubble')
	.attr('stroke', '#fff')
}

const manageOver = (event, data) => {

	let country;
	let ratingText;
	let dataDate;
	let sufficiencyText;
	let sufficiencyDate;

	if(data.properties)
	{

		let suffData = sufficiencyRatings.find(f => f.weight === data.properties.sufficiency)

		country = data.properties.ADMIN;
		ratingText = mapRatings.find(f => f.rating === data.properties.rating).text;
		dataDate = data.properties.dataDate
		sufficiencyText = suffData ? suffData.name : ''
		sufficiencyDate = data.properties.sufficiencyDate

		geo.selectAll('.' + data.properties.ISO_A3)
		.raise()
		.attr('stroke', '#333')
	}
	else{


		let suffData = sufficiencyRatings.find(f => f.weight === data.sufficiency)

		if(data.country_code !=  'EUU')country = filtered.find(f => f.properties.ISO_A3 === data.country_code).properties.ADMIN;
		else country = 'EU'

		ratingText = mapRatings.find(f => f.rating === data.rating).text;
		dataDate = data.dataDate
		sufficiencyText = suffData ? suffData.name : ''
		sufficiencyDate = data.sufficiencyDate

		bubbles.select('.' + data.country_code)
		.raise()
		.attr('stroke', '#333')
		

	}

	country = country == 'United States of America' ? 'US' : country
	country = country == 'United Kingdom' ? 'UK' : country
	country = country == 'United Arab Emirates' ? 'UAE' : country


	tooltip.html(`
		<p class='tooltip-country'>${country} ${ratingText}</p>
		<p class='tooltip-date'>${dataDate ? 'Last updated ' + dataDate : ''}</p>
		<p class='tooltip-country'>${sufficiencyText ? country + "'s latest pledge is " + sufficiencyText : ''}</p>
		<p class='tooltip-date'>${sufficiencyDate ? 'Last updated ' + sufficiencyDate : ''}</p>
	`)
	
}

const manageMove = (event) => {

    tooltip.classed('over', true)

    let left = event.clientX + -atomEl.getBoundingClientRect().left;
    let top = event.clientY + -atomEl.getBoundingClientRect().top;


    let tWidth = tooltip.node().getBoundingClientRect().width;
    let tHeight = tooltip.node().getBoundingClientRect().height;

    let posX = left - (tWidth /2);
    let posY = top + 15;

    if(posX + tWidth > width) posX = width - tWidth;
    if(posX < margin.left) posX = margin.left;

    if(posY + tHeight > height) posY = posY - tHeight - 25;
    if(posY < 0) posY = 0;

    tooltip.style('left',  posX + 'px')
    tooltip.style('top', posY + 'px')

}

window.onresize = (event) => {

    map.style('height', window.innerHeight + 'px')
         
}