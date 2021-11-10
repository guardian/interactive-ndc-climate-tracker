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

const margin = {top:25, right:5, bottom:25, left: 0}

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

const admin = d3.select('.tooltip-country');
const ndc = d3.select('.tooltip-ndc-rating');
const ndcDate = d3.select('.tooltip-ndc-date');
const pledge = d3.select('.tooltip-pledge');
const pledgeDate = d3.select('.tooltip-pledge-date');

const geo = map.append('g')
const bubbles = map.append('g')

const scrolly = new ScrollyTeller({
    parent: document.querySelector("#scrolly-1"),
    triggerTop: .75, // percentage from the top of the screen that the trigger should fire
    triggerTopMobile: .75,
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
{weight: 1, name: 'Critically insufficient', center: isMobile ? [width / 2, height / 5] : [width / 5, height / 2]},
{weight: 2, name: 'Highly insufficient', center: isMobile ? [width / 2, (height / 5) * 2] : [(width / 5) * 2, height / 2]},
{weight: 3, name: 'Insufficient', center: isMobile ? [width / 2, (height / 5) * 3] :[(width / 5) * 3, height / 2]},
{weight: 4, name: 'Almost Sufficient', center: isMobile ? [width / 2, (height / 5) * 4] : [(width / 5) * 4, height / 2]},
{weight: 5, name: 'Paris Agreement compatible', center: isMobile ? [width / 2, (height / 5) * 5] : [(width / 5) * 5, height / 2]}
]
	
let allData;

let nodes = []
	
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

			console.log(d)

			emissions = emissionsRaw.find(f => f.country_code === 'EUU');

			let rad = radius(emissions.emissions)
			let match = filtered.find(f => f.properties.ISO_A3 === 'ESP')
			let cx = match.properties.centroid[0]
			let cy = match.properties.centroid[1]

			nodes.push({country_code:'EUU', rating: allData.updateMapdataWTimestamps.find(f => f.country_code === 'ESP').rating, sufficiency:d.rating, r:rad, x:cx, y:cy, centroid:match.properties.centroid, sufficiencyDate:d.timestamp})
		}


	})

	

	allData.updateMapdataWTimestamps.forEach(data => {

		let node = nodes.find(f => f.country_code === data.country_code)

		if(node){
			node.rating = data.rating

			let geoCountry = filtered.find(f => f.properties.ISO_A3 === data.country_code);

			geoCountry.properties.sufficiency = node.sufficiency;
			geoCountry.properties.sufficiencyDate = node.sufficiencyDate;
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
	.attr('class', d => 'country-stroke ' + d.properties.ISO_A3 + ' rating-' + d.properties.rating)
	.attr('d', path)
	.attr('fill', '#DADADA')
	.attr('stroke-width', d => isMobile ? 0.5 : 1.5)
	.filter(d => d.properties.rating)
	.on('mousemove', (e,d) => manageMove(e))
	.on('mouseover', (e,d) => {
		    manageOver(e, d)
		    tooltip.classed('over', true)
	})
	.on('mouseout', () => manageOut())

	geo.append("path")
    .datum(topojson.mesh(worldMap, worldMap.objects['world-map-crimea-ukr'], (a, b) => a !== b ))
    .attr("d", path)
    .attr("class", "subunit-boundary")
	.attr('stroke', '#fff')
	.attr('fill', 'none')
	.attr('stroke-width', d => isMobile ? 0.5 : 1)

	bubbles.selectAll('circle')
	.data(nodes)
	.enter()
	.append('circle')
	.attr('class', d => d.country_code + ' rating-' + d.rating )
	.attr('cx', d => d.centroid[0])
	.attr('cy', d => d.centroid[1])
	.attr('r', 0)
	.on('mousemove', (e,d) => manageMove(e))
	.on('mouseover', (e,d) => {
		    manageOver(e, d)
		    tooltip.classed('over', true)
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

		geo.selectAll('.BRA')
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

		
	}})
	scrolly.addTrigger({num:5, do: () => {

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


	}})

	scrolly.watchScroll();

})

const manageOut = () => {

	tooltip.classed('over', false)
	admin.html('')
	ndc.html('')
	ndcDate.html('')
	pledge.html('')
	pledgeDate.html('')

	geo.select('.subunit-boundary')
	.raise()

	geo.selectAll('.country-stroke')
	.attr('stroke', 'none')
}

const manageOver = (event, data) => {

	let country;
	let ratingText;
	let dataDate;
	let sufficiencyText;
	let sufficiencyDate;

	if(data.properties)
	{
		country = data.properties.ADMIN;
		ratingText = mapRatings.find(f => f.rating === data.properties.rating).text;
		dataDate = data.properties.dataDate
		sufficiencyText = sufficiencyRatings.find(f => f.weight === data.properties.sufficiency).name
		sufficiencyDate = data.properties.sufficiencyDate

		geo.selectAll('.' + data.properties.ISO_A3)
		.raise()
		.attr('stroke', '#333')
	}
	else{

		if(data.country_code !=  'EUU')country = filtered.find(f => f.properties.ISO_A3 === data.country_code).properties.ADMIN;
		else country = 'EU'

		ratingText = mapRatings.find(f => f.rating === data.rating).text;
		dataDate = data.dataDate;
		sufficiencyDate = data.sufficiencyDate
	}

	if(dataDate)ndcDate.html()



	admin.html(`<p class='tooltip-country'>${country}</p>
		<p class='tooltip-rating'>${ratingText}</p<br>
		<p class='tooltip-date'>Last updated ${dataDate}</p>
		${country}'s latest pledge is ${sufficiencyText}
		<p class='tooltip-date'>Last updated ${sufficiencyDate}</p>`)
	



	

	

		

	//admin.html(data.properties.ADMIN)

	/*
	let pledgeRaw = allData.sufficiencyMapdataWTimestamps.find(f => f.country_code === data.country_code);
	let pledgeRating = pledgeRaw == undefined ? '' : pledgeRaw.rating;
	let pledgeText = pledgeRating == '' ? '' : sufficiencyRatings.find(f => f.weight === pledgeRating).name;

	let ndcDateRaw = allData.updateMapdataWTimestamps.find(f => f.country_code === data.country_code).timestamp;

	
	ndc.html(ratingText)
	ndcDate.html('xx/xx/xxxx last update')
	pledge.html(pledgeText)
	pledgeDate.html('xx/xx/xxxx last update')*/
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

    if(!isMobile && posY + tHeight > height) posY = posY - tHeight - 25;
    if(posY < 0) posY = 0;

    tooltip.style('left',  posX + 'px')
    tooltip.style('top', posY + 'px')

}

window.onresize = (event) => {

    svg.style('height', window.innerHeight + 'px')
         
}