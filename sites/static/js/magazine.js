$( document ).ready(function() {
  // If there's no "magazineposts" place, ignore this function
  if(!$('#magazineposts').length)
	  return;

  $.get( "https://fedoramagazine.org/wp-json/wp/v2/posts", { per_page: 3 } )
   .done(function( data ) {
     $.each(data, function(i, item){
       const postlink = item.link;
       const posttitle = item.title.rendered;
       const date = new Date(item.date);
       const month = date.toLocaleString('en-us', { month: 'long' });
       const postdate = ( month + ' ' + date.getDate()+', ' +date.getFullYear());
       $.get(item._links['wp:featuredmedia'][0].href).done(function(imagedata){
         $("#magazineposts").append("<div class='card'><a href='"+postlink+"'><img src='"+imagedata.media_details.sizes.medium_large.source_url+"' class='card-img-top'></a><div class='card-body font-weight-bold '><a class='text-dark' href='"+postlink+"'>"+posttitle+"</a><div><small>"+postdate+"</small></div></div></div>")
      });
    })
  });
});
